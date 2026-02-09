'use client';

import { useRouter } from 'next/navigation';
import { Music, LogIn, Library, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser, useCollection, useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { UserNav } from '@/components/user-nav';
import type { Session, Song, SessionParticipant, UserProfile } from '@/lib/types';
import { collection, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

function SessionCard({ session }: { session: Session }) {
  const router = useRouter();
  const { firestore } = useFirebase();

  const songRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'songs', session.songId) : null),
    [firestore, session.songId]
  );
  const { data: song, loading: songLoading } = useDoc<Song>(songRef);

  const participantsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, `sessions/${session.id}/sessionParticipants`) : null),
    [firestore, session.id]
  );
  const { data: participants, loading: participantsLoading } = useCollection<SessionParticipant>(participantsRef);
  
  const handleJoin = () => {
    router.push(`/session/${session.id}`);
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        {songLoading ? (
           <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
        ) : (
          <CardTitle className="truncate">{song?.title || 'Unbekannter Song'}</CardTitle>
        )}
        <CardDescription>{song?.artist || ' '}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {participantsLoading ? (
                 <div className="h-4 w-8 bg-muted rounded animate-pulse" />
            ) : (
                <span>{participants?.length || 0} Teilnehmer</span>
            )}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleJoin}>
          <LogIn className="mr-2" />
          Beitreten
        </Button>
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
  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const sessionsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'sessions') : null),
    [firestore]
  );
  const { data: sessions, loading: sessionsLoading } = useCollection<Session>(sessionsRef);
  
  const loading = userLoading || profileLoading || sessionsLoading;

  const showLibrary = userProfile && (userProfile.role === 'creator' || userProfile.role === 'admin');

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
                <Card key={i} className="h-[220px]">
                    <CardHeader>
                        <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-1/2 bg-muted rounded animate-pulse mt-2" />
                    </CardHeader>
                    <CardContent>
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
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}

        {!loading && (!sessions || sessions.length === 0) && (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <Music className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium text-muted-foreground">Keine aktiven Sitzungen</h3>
                <p className="mt-1 text-sm text-muted-foreground">Momentan finden keine Sitzungen statt. Schauen Sie später noch einmal vorbei!</p>
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
