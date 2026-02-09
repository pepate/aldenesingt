'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Music, LogIn, Library, Loader2, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  useUser,
  useCollection,
  useFirebase,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { UserNav } from '@/components/user-nav';
import type {
  Session,
  Song,
  SessionParticipant,
  UserProfile,
} from '@/lib/types';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

function SessionCard({
  session,
  userProfile,
}: {
  session: Session;
  userProfile: UserProfile | null;
}) {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const songRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'songs', session.songId) : null),
    [firestore, session.songId]
  );
  const { data: song, loading: songLoading } = useDoc<Song>(songRef);

  const participantsRef = useMemoFirebase(
    () =>
      firestore
        ? collection(firestore, `sessions/${session.id}/sessionParticipants`)
        : null,
    [firestore, session.id]
  );
  const { data: participants, loading: participantsLoading } =
    useCollection<SessionParticipant>(participantsRef);

  const handleJoin = () => {
    router.push(`/session/${session.id}`);
  };

  const handleDelete = async () => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'sessions', session.id));
      toast({
        title: 'Sitzung gelöscht',
        description: 'Die Sitzung wurde erfolgreich entfernt.',
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Sitzung konnte nicht gelöscht werden.',
      });
    }
  };

  const hasArtwork = !songLoading && song?.artworkUrl;

  return (
    <Card className="flex flex-col group relative overflow-hidden">
      {hasArtwork && (
        <>
          <Image
            src={song.artworkUrl!}
            alt={song.title || 'Artwork'}
            fill
            className="object-cover -z-10 transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent -z-10" />
        </>
      )}
      <CardHeader className="relative">
        <div className="flex justify-between items-start gap-4">
          <div>
            {songLoading ? (
              <div className={`h-5 w-3/4 rounded animate-pulse mb-1 ${hasArtwork ? 'bg-white/20' : 'bg-muted'}`} />
            ) : (
              <CardTitle className={`truncate leading-tight text-lg ${hasArtwork ? 'text-white' : ''}`}>
                {song?.title || 'Unbekannter Song'}
              </CardTitle>
            )}
            <CardDescription className={`mt-1 ${hasArtwork ? 'text-white/80' : ''}`}>
              {songLoading ? (
                <div className={`h-4 w-1/2 rounded animate-pulse ${hasArtwork ? 'bg-white/20' : 'bg-muted'}`} />
              ) : (
                 song?.artist || ' '
              )}
            </CardDescription>
          </div>
          {!hasArtwork && (
             songLoading ? (
                <div className="w-12 h-12 flex-shrink-0 bg-muted rounded-md animate-pulse" />
            ) : (
                <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-muted rounded-md text-muted-foreground">
                    <Music className="h-6 w-6" />
                </div>
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow flex items-center justify-between text-sm pt-0 relative">
        <div className={`flex items-center gap-2 ${hasArtwork ? 'text-white/80' : 'text-muted-foreground'}`}>
          <Users className="h-4 w-4" />
          {participantsLoading ? (
            <div className={`h-4 w-8 rounded animate-pulse ${hasArtwork ? 'bg-white/20' : 'bg-muted'}`} />
          ) : (
            <span>{participants?.length || 0} Teilnehmer</span>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center gap-2 relative">
        <Button className="w-full" onClick={handleJoin}>
          <LogIn className="mr-2" />
          Beitreten
        </Button>
        {(userProfile?.role === 'admin' ||
          userProfile?.role === 'superadmin') && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                <AlertDialogDescription>
                  Diese Aktion kann nicht rückgängig gemacht werden. Dadurch
                  wird die Sitzung dauerhaft gelöscht.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}

function HomeComponent() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, loading: profileLoading } =
    useDoc<UserProfile>(userProfileRef);

  const sessionsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'sessions') : null),
    [firestore]
  );
  const { data: sessions, loading: sessionsLoading } =
    useCollection<Session>(sessionsRef);

  const loading = userLoading || profileLoading || sessionsLoading;

  const showLibrary =
    userProfile &&
    (userProfile.role === 'creator' ||
      userProfile.role === 'admin' ||
      userProfile.role === 'superadmin');

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="p-4 sm:p-6 flex justify-between items-center border-b">
        <div className="flex items-center gap-3">
          <Music className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">SyncScroll</h1>
        </div>
        <div className="flex items-center gap-4">
          {showLibrary && (
            <Button variant="ghost" onClick={() => router.push('/library')}>
              <Library className="mr-2" />
              Meine Bibliothek
            </Button>
          )}
          {user ? (
            <UserNav />
          ) : (
            <Button variant="ghost" onClick={() => router.push('/auth')}>
              <LogIn className="mr-2" />
              Anmelden
            </Button>
          )}
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="text-left mb-10">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Offene Sitzungen
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Treten Sie einer der Live-Sitzungen bei und spielen Sie gemeinsam.
          </p>
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-1/2 bg-muted rounded animate-pulse mt-2" />
                    </div>
                    <div className="h-12 w-12 bg-muted rounded-md animate-pulse flex-shrink-0" />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-5 w-1/3 bg-muted rounded animate-pulse" />
                </CardContent>
                <CardFooter>
                  <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {!loading && sessions && sessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                userProfile={userProfile}
              />
            ))}
          </div>
        )}

        {!loading && (!sessions || sessions.length === 0) && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Music className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium text-muted-foreground">
              Keine aktiven Sitzungen
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Momentan finden keine Sitzungen statt. Schauen Sie später noch
              einmal vorbei!
            </p>
          </div>
        )}
      </main>
      <footer className="p-4 text-center text-sm text-muted-foreground">
        <p>
          &copy; {new Date().getFullYear()} SyncScroll. Alle Rechte
          vorbehalten.
        </p>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <FirebaseClientProvider>
      <HomeComponent />
    </FirebaseClientProvider>
  );
}
