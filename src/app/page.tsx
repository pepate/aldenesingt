'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Music, Users, LogIn, Library, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { UserNav } from '@/components/user-nav';

function HomeComponent() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();
  const [sessionId, setSessionId] = useState<string>('');
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const handleJoinSession = () => {
    if (!sessionId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Ungültige Sitzungs-ID',
        description: 'Bitte gib eine gültige Sitzungs-ID ein.',
      });
      return;
    }
    setIsJoining(true);
    router.push(`/session/${sessionId.trim().toUpperCase()}`);
  };

  const handleNavigateToLibrary = () => {
    router.push('/library');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="p-4 sm:p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Music className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">SyncScroll</h1>
        </div>
        <div>
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

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Synchronisierte Notenblätter
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Starte eine Sitzung, teile deinen Bildschirm und lasse alle mit
              synchronisiertem Scrollen mitlesen. Perfekt für Bands und Chöre.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="flex flex-col bg-card/50 hover:bg-card transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Library className="h-6 w-6 text-accent" />
                  <CardTitle>Zur Bibliothek</CardTitle>
                </div>
                <CardDescription>
                  Dokumente hochladen, verwalten und Sitzungen starten.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  Melde dich an, um deine persönliche Dokumenten-Bibliothek zu
                  nutzen. Lade PDFs hoch, organisiere sie und starte mit einem
                  Klick eine neue SyncScroll-Sitzung.
                </p>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={handleNavigateToLibrary}>
                  <ArrowRight className="mr-2" />
                  Bibliothek öffnen
                </Button>
              </CardFooter>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-accent" />
                  <CardTitle>Bestehender Sitzung beitreten</CardTitle>
                </div>
                <CardDescription>
                  Gib eine Sitzungs-ID ein, um beizutreten und mitzulesen.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <Input
                  placeholder="Sitzungs-ID eingeben"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                  onKeyUp={(e) => e.key === 'Enter' && handleJoinSession()}
                  className="uppercase text-center text-lg font-bold tracking-widest"
                  maxLength={4}
                />
              </CardContent>
              <CardFooter>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleJoinSession}
                  disabled={isJoining}
                >
                  <Users className="mr-2" />
                  {isJoining ? 'Tritt bei...' : 'Sitzung beitreten'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
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
