'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Music,
  LogIn,
  Library,
  Loader2,
  Trash2,
  Share2,
  Crown,
  Clock,
  Radio,
} from 'lucide-react';
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
  UserProfile,
  RecentPlay,
} from '@/lib/types';
import {
  collection,
  doc,
  deleteDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
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
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
    <Card
      className="flex flex-col group relative overflow-hidden cursor-pointer card-hover border-border/60"
      onClick={handleJoin}
    >
      {hasArtwork && (
        <div className="absolute top-0 right-0 h-full w-1/2 opacity-40 group-hover:opacity-60 transition-opacity duration-300">
            <Image
                src={song.artworkUrl!}
                alt=""
                fill
                className="object-cover"
                sizes="50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/50 to-background" />
        </div>
      )}
      {/* Live indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500/90 text-white text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        Live
      </div>
      <CardHeader className="relative flex-grow">
        <div>
            {songLoading ? (
              <>
                <div className="h-5 w-3/4 rounded animate-pulse mb-1 bg-muted" />
                <div className="h-4 w-1/2 rounded animate-pulse mt-1 bg-muted" />
              </>
            ) : (
              <>
                <CardTitle className="truncate leading-tight text-lg pr-12">
                  {song?.title || 'Unbekannter Song'}
                </CardTitle>
                <CardDescription className="mt-1">
                  {song?.artist || ' '}
                </CardDescription>
              </>
            )}
        </div>
      </CardHeader>
      <CardContent className="flex-shrink-0 text-sm pt-0 relative">
         <div className="flex items-center gap-2 text-muted-foreground">
            <Crown className="h-4 w-4 text-amber-400" />
            <span className="truncate">
                {session.hostName || 'Unbekannter Host'}
            </span>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center gap-2 relative">
        <Button className="w-full bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90">
          <LogIn className="mr-2" />
          Beitreten
        </Button>
        {userProfile?.role === 'admin' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                onClick={(e) => e.stopPropagation()}
              >
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

function RecentlyPlayedRow({ recentlyPlayed }: { recentlyPlayed: RecentPlay[] }) {
  const router = useRouter();

  if (!recentlyPlayed.length) return null;

  // Show most recently played first, max 10
  const items = [...recentlyPlayed]
    .sort((a, b) => {
      const aMs = a.openedAt?.toMillis?.() ?? 0;
      const bMs = b.openedAt?.toMillis?.() ?? 0;
      return bMs - aMs;
    })
    .slice(0, 10);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Zuletzt gespielt</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {items.map((play) => (
          <button
            key={play.songId}
            onClick={() => router.push(`/library/${play.songId}`)}
            className="flex-shrink-0 w-36 group text-left"
          >
            <div className="relative w-36 h-36 rounded-xl overflow-hidden bg-muted mb-2 shadow-sm group-hover:shadow-md transition-shadow">
              {play.artworkUrl ? (
                <Image
                  src={play.artworkUrl}
                  alt={play.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="144px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-violet-500/20">
                  <Music className="h-10 w-10 text-primary/60" />
                </div>
              )}
            </div>
            <p className="text-sm font-medium truncate">{play.title}</p>
            <p className="text-xs text-muted-foreground truncate">{play.artist}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function HomeComponent() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

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

  const userSession = useMemo(() => {
    if (!user || !sessions) return null;
    return sessions.find(s => s.id === user.uid);
  }, [sessions, user]);


  const canCreateSongs =
    userProfile &&
    (userProfile.role === 'creator' || userProfile.role === 'admin');

  // Any user with a profile can start a session.
  const canStartSession = !!userProfile;

  const songsCollectionRef = useMemoFirebase(
    () =>
      firestore && canStartSession
        ? collection(firestore, 'songs')
        : null,
    [firestore, canStartSession]
  );
  const { data: songs, loading: songsLoading } =
    useCollection<Song>(songsCollectionRef);

  const loading =
    userLoading ||
    profileLoading ||
    sessionsLoading ||
    (canStartSession && songsLoading);

  const createSession = async (songId: string) => {
    if (!user || !firestore || !userProfile) return;
    const sessionId = user.uid; // Use user's UID as session ID
    try {
      const sessionRef = doc(firestore, 'sessions', sessionId);
      await setDoc(sessionRef, {
        id: sessionId,
        hostId: user.uid,
        hostName: userProfile.displayName || user.displayName || 'Unbekannter Host',
        songId: songId,
        scroll: 0,
        transpose: 0,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      });
      router.push(`/session/${sessionId}?host=true`);
    } catch (error) {
      console.error('Failed to create session:', error);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Sitzung konnte nicht erstellt werden.',
      });
    }
  };

  const handleStartSession = async () => {
    if (selectedSongId) {
      await createSession(selectedSongId);
      setIsSessionDialogOpen(false);
      setSelectedSongId(null);
    }
  };

  const recentlyPlayed = userProfile?.recentlyPlayed ?? [];
  const showRecentlyPlayed = !!user && recentlyPlayed.length > 0;
  const hasSessions = !loading && sessions && sessions.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="p-4 flex justify-between items-center border-b gap-4 bg-card/60 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-sm">
            <Music className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold gradient-text">Aldene Singt</h1>
        </div>
        <div className="flex items-center flex-wrap justify-end gap-2">
          {canCreateSongs && (
            <Button variant="ghost" onClick={() => router.push('/library')}>
              <Library className="mr-2 h-4 w-4" />
              Songs
            </Button>
          )}

          {canStartSession && (
            <>
              {userSession ? (
                 <Button onClick={() => router.push(`/session/${userSession.id}`)}>
                    <Share2 className="mr-2 h-4 w-4" /> Session öffnen
                </Button>
              ) : (
                <Dialog
                  open={isSessionDialogOpen}
                  onOpenChange={setIsSessionDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90">
                      <Share2 className="mr-2 h-4 w-4" /> Session starten
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Neue Session starten</DialogTitle>
                      <DialogDescription>
                        Wählen Sie einen Song aus, um eine neue Live-Sitzung zu
                        starten.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {songsLoading ? (
                        <div className="flex justify-center">
                          <Loader2 className="animate-spin" />
                        </div>
                      ) : (
                        <Select
                          onValueChange={setSelectedSongId}
                          value={selectedSongId || ''}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Wählen Sie einen Song..." />
                          </SelectTrigger>
                          <SelectContent>
                            {songs?.map((song) => (
                              <SelectItem key={song.id} value={song.id}>
                                <div className="flex items-center gap-3">
                                  {song.artworkUrl ? (
                                    <Image
                                      src={song.artworkUrl}
                                      alt={song.title}
                                      width={24}
                                      height={24}
                                      className="rounded-sm object-cover"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 flex items-center justify-center bg-muted rounded-sm text-muted-foreground">
                                      <Music className="h-4 w-4" />
                                    </div>
                                  )}
                                  <span>
                                    {song.title} - {song.artist}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsSessionDialogOpen(false)}
                      >
                        Abbrechen
                      </Button>
                      <Button
                        onClick={handleStartSession}
                        disabled={!selectedSongId || songsLoading}
                        className="bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90"
                      >
                        Session jetzt starten
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
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
        {/* Hero section – shown when no sessions are active */}
        {!loading && !hasSessions && !showRecentlyPlayed && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-lg glow-primary">
                <Music className="h-10 w-10 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center">
                <Radio className="h-2.5 w-2.5 text-white" />
              </div>
            </div>
            <h2 className="text-3xl font-bold mb-2 gradient-text">Willkommen!</h2>
            <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
              Momentan gibt es keine aktiven Sessions. Starte eine, um Songblätter live mit anderen zu teilen.
            </p>
            {!user && (
              <Button onClick={() => router.push('/auth')} size="lg" className="bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90">
                <LogIn className="mr-2" />
                Anmelden & loslegen
              </Button>
            )}
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-border/60">
                <CardHeader>
                  <div className="h-5 w-3/4 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
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

        {hasSessions && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-xl font-semibold">Aktive Sessions</h2>
              <span className="text-sm text-muted-foreground">({sessions!.length})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sessions!.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  userProfile={userProfile}
                />
              ))}
            </div>
          </div>
        )}

        {/* Recently played */}
        {!loading && showRecentlyPlayed && (
          <RecentlyPlayedRow recentlyPlayed={recentlyPlayed} />
        )}

        {/* Empty state when logged in but no sessions */}
        {!loading && hasSessions === false && showRecentlyPlayed && (
          <div className="text-center py-10 border-2 border-dashed rounded-xl mb-8 border-border/60">
            <Radio className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">Keine aktiven Sessions – starte eine oben!</p>
          </div>
        )}
      </main>
      <footer className="p-4 text-center text-sm text-muted-foreground border-t">
        <p>
          &copy; {new Date().getFullYear()} Aldene Singt. Alle Rechte
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
