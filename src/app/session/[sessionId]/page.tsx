'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Music,
  User,
  Crown,
  Loader2,
  AlertTriangle,
  Library,
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
import { FirebaseClientProvider } from '@/firebase/client-provider';
import {
  useDoc,
  useUser,
  useCollection,
  useFirebase,
} from '@/firebase';
import type { Session, PdfDocument } from '@/lib/types';
import { doc, updateDoc, collection } from 'firebase/firestore';

function SessionPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0].toUpperCase()
    : params.sessionId.toUpperCase();

  const sessionRef = firestore ? doc(firestore, 'sessions', sessionId) : null;
  const {
    data: session,
    loading: sessionLoading,
    error: sessionError,
  } = useDoc<Session>(sessionRef);

  const isHost = session?.hostId === user?.uid;

  const pdfDocumentsRef =
    firestore && user
      ? collection(firestore, 'users', user.uid, 'pdf_documents')
      : null;
  const { data: userDocuments, loading: docsLoading } =
    useCollection<PdfDocument>(pdfDocumentsRef);

  const [currentDocument, setCurrentDocument] = useState<PdfDocument | null>(
    null
  );

  // Effect to handle session errors
  useEffect(() => {
    if (sessionError) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description:
          'Sitzung nicht gefunden. Bitte überprüfe die ID und versuche es erneut.',
      });
      router.push('/');
    }
  }, [sessionError, router, toast]);

  // Effect to find the current document details when session or user documents change
  useEffect(() => {
    if (session && userDocuments) {
      const doc = userDocuments.find((d) => d.id === session.songId) || null;
      setCurrentDocument(doc);
    }
  }, [session, userDocuments]);

  const handleSongChange = async (newSongId: string) => {
    if (!sessionRef || !isHost) return;

    try {
      await updateDoc(sessionRef, { songId: newSongId, scroll: 0 });
      const newDoc = userDocuments?.find((d) => d.id === newSongId);
      toast({
        title: 'Dokument gewechselt',
        description: `Neues Dokument: ${newDoc?.title}`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Konnte das Dokument nicht wechseln.',
      });
    }
  };

  const copySessionId = () => {
    if (sessionId) {
      navigator.clipboard.writeText(sessionId);
      toast({
        title: 'Kopiert!',
        description: 'Sitzungs-ID wurde in die Zwischenablage kopiert.',
      });
    }
  };

  if (sessionLoading || docsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Sitzung wird geladen...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-destructive">
        <AlertTriangle className="h-12 w-12" />
        <h2 className="mt-4 text-2xl font-bold">Sitzung nicht gefunden</h2>
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
              {isHost ? (
                <Select
                  onValueChange={handleSongChange}
                  value={session.songId}
                  disabled={!userDocuments || userDocuments.length === 0}
                >
                  <SelectTrigger className="w-auto md:w-[300px] font-semibold text-lg">
                    <SelectValue placeholder="Wähle ein Dokument..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userDocuments?.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-semibold text-lg">
                  {currentDocument?.title || 'SyncScroll'}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/library')}
          >
            <Library className="mr-2 h-4 w-4" />
            Bibliothek
          </Button>
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
        {currentDocument && sessionId && (
          <PdfViewer
            songUrl={currentDocument.url}
            sessionId={sessionId}
            isHost={isHost}
            sessionRef={sessionRef}
            initialScroll={session.scroll}
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
      <FirebaseClientProvider>
        <SessionPageContent />
      </FirebaseClientProvider>
    </Suspense>
  );
}
