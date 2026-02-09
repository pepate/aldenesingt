'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Music,
  User,
  Crown,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import PdfViewer from '@/components/pdf-viewer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { songs } from '@/lib/songs';

type SessionData = {
  songId: string;
  songUrl: string;
  title: string;
};

const SONG_POLL_INTERVAL = 2000; // 2 seconds

function SessionPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;
  const isHost = searchParams.get('host') === 'true';

  useEffect(() => {
    if (!sessionId) return;

    const fetchSessionData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/session/${sessionId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(
              'Sitzung nicht gefunden. Bitte überprüfe die ID und versuche es erneut.'
            );
          }
          throw new Error('Laden der Sitzungsdaten fehlgeschlagen.');
        }
        const data = await response.json();
        setSessionData(data);
      } catch (err: any) {
        setError(err.message);
        toast({
          variant: 'destructive',
          title: 'Fehler',
          description: err.message,
        });
        setTimeout(() => router.push('/'), 3000);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId, router, toast]);

  // Polling for song changes for clients
  useEffect(() => {
    if (isHost || !sessionId || !sessionData) return;

    const pollSong = async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}`);
        if (!response.ok) return;
        const data: SessionData = await response.json();

        if (data.songUrl !== sessionData.songUrl) {
          setSessionData(data);
          toast({
            title: 'Dokument wurde geändert',
            description: `Das angezeigte Dokument wurde zu "${data.title}" gewechselt.`,
          });
        }
      } catch (err) {
        console.error('Failed to poll for song change:', err);
      }
    };

    const intervalId = setInterval(pollSong, SONG_POLL_INTERVAL);
    return () => clearInterval(intervalId);
  }, [isHost, sessionId, sessionData, toast]);

  const handleSongChange = async (newSongId: string) => {
    if (!sessionId || !isHost) return;

    try {
      const response = await fetch(`/api/session/${sessionId}/update-song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: newSongId }),
      });

      if (!response.ok) {
        throw new Error('Failed to update song');
      }

      const newSong = songs.find((s) => s.id === newSongId);
      if (newSong) {
        setSessionData({
          songId: newSong.id,
          title: newSong.title,
          songUrl: newSong.url,
        });
        toast({
          title: 'Dokument gewechselt',
          description: `Neues Dokument: ${newSong.title}`,
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Konnte das Dokument nicht wechseln.',
      });
    }
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
    toast({
      title: 'Kopiert!',
      description: 'Sitzungs-ID wurde in die Zwischenablage kopiert.',
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Sitzung wird geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-destructive">
        <AlertTriangle className="h-12 w-12" />
        <h2 className="mt-4 text-2xl font-bold">{error}</h2>
        <p className="mt-2 text-muted-foreground">
          Weiterleitung zur Startseite...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between p-3 border-b shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/">
              <ArrowLeft />
              <span className="sr-only">Zurück zur Startseite</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <div className="hidden sm:block">
              {!isHost && (
                <span className="font-semibold text-lg">
                  {sessionData?.title || 'SyncScroll'}
                </span>
              )}
              {isHost && sessionData && (
                <Select
                  onValueChange={handleSongChange}
                  value={sessionData.songId}
                >
                  <SelectTrigger className="w-auto md:w-[300px] font-semibold text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {songs.map((song) => (
                      <SelectItem key={song.id} value={song.id}>
                        {song.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-muted-foreground">
            {isHost ? (
              <Crown className="h-5 w-5 text-amber-400" />
            ) : (
              <User className="h-5 w-5" />
            )}
            <span className="font-mono text-sm font-semibold">
              {isHost ? 'HOST' : 'ZUSCHAUER'}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-md border p-2">
            <span className="font-mono text-sm font-semibold text-muted-foreground">
              ID: {sessionId}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={copySessionId}
              className="h-7 w-7"
            >
              <Copy className="h-4 w-4" />
              <span className="sr-only">Sitzungs-ID kopieren</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {sessionData && (
          <PdfViewer
            songUrl={sessionData.songUrl}
            sessionId={sessionId}
            isHost={isHost}
          />
        )}
      </main>
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-muted-foreground">Wird geladen...</p>
        </div>
      }
    >
      <SessionPageContent />
    </Suspense>
  );
}
