'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Music, Users, LogIn, Upload } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { songs } from '@/lib/songs';

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedSong, setSelectedSong] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isJoining, setIsJoining] = useState<boolean>(false);

  const handleStartSession = async () => {
    if (!selectedSong) {
      toast({
        variant: 'destructive',
        title: 'No Song Selected',
        description: 'Please select a song to start a session.',
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: selectedSong }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const { sessionId: newSessionId } = await response.json();
      router.push(`/session/${newSessionId}?host=true`);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not create a new session. Please try again.',
      });
      setIsCreating(false);
    }
  };

  const handleJoinSession = () => {
    if (!sessionId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Invalid Session ID',
        description: 'Please enter a valid session ID.',
      });
      return;
    }
    setIsJoining(true);
    router.push(`/session/${sessionId.trim().toUpperCase()}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Music className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">SyncScroll</h1>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Synchronized Sheet Music
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Host a session, share your screen, and let everyone follow along
              with synchronized scrolling. Perfect for bands and choirs.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Upload className="h-6 w-6 text-accent" />
                  <CardTitle>Start a New Session</CardTitle>
                </div>
                <CardDescription>
                  Choose a document and become the host.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <Select onValueChange={setSelectedSong} value={selectedSong}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a song/document..." />
                  </SelectTrigger>
                  <SelectContent>
                    {songs.map((song) => (
                      <SelectItem key={song.id} value={song.id}>
                        {song.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={handleStartSession}
                  disabled={isCreating}
                >
                  <LogIn className="mr-2" />
                  {isCreating ? 'Starting...' : 'Start Session'}
                </Button>
              </CardFooter>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Users className="h-6 w-6 text-accent" />
                  <CardTitle>Join an Existing Session</CardTitle>
                </div>
                <CardDescription>
                  Enter a session ID to join and follow along.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <Input
                  placeholder="Enter Session ID"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                  onKeyUp={(e) => e.key === 'Enter' && handleJoinSession()}
                  className="uppercase"
                  maxLength={3}
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
                  {isJoining ? 'Joining...' : 'Join Session'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
      <footer className="p-4 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} SyncScroll. All rights reserved.</p>
      </footer>
    </div>
  );
}
