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
  Users,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import {
  useDoc,
  useUser,
  useCollection,
  useFirebase,
  useMemoFirebase,
} from '@/firebase';
import type { Session, PdfDocument, SessionParticipant } from '@/lib/types';
import {
  doc,
  updateDoc,
  collection,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { UserNav } from '@/components/user-nav';

function SessionPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0].toUpperCase()
    : params.sessionId.toUpperCase();

  const sessionRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'sessions', sessionId) : null),
    [firestore, sessionId]
  );
  const {
    data: session,
    loading: sessionLoading,
    error: sessionError,
  } = useDoc<Session>(sessionRef);

  const participantsRef = useMemoFirebase(
    () =>
      firestore
        ? collection(firestore, 'sessions', sessionId, 'sessionParticipants')
        : null,
    [firestore, sessionId]
  );
  const { data: participants, loading: participantsLoading } =
    useCollection<SessionParticipant>(participantsRef);

  const isHost = session?.hostId === user?.uid;

  // Global documents for the host's dropdown
  const allDocumentsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'pdf_documents') : null),
    [firestore]
  );
  const { data: allDocuments, loading: docsLoading } =
    useCollection<PdfDocument>(allDocumentsRef);
  
  // Current document for the session
  const currentDocumentRef = useMemoFirebase(
    () => (firestore && session?.songId ? doc(firestore, 'pdf_documents', session.songId) : null),
    [firestore, session?.songId]
  );
  const {data: currentDocument, loading: currentDocLoading} = useDoc<PdfDocument>(currentDocumentRef);


  // Effect to handle session errors
  useEffect(() => {
    if (!sessionLoading && !session) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description:
          'Sitzung nicht gefunden. Bitte überprüfe die ID und versuche es erneut.',
      });
      router.push('/');
    }
  }, [session, sessionLoading, router, toast]);

  // Effect to join/leave session
  useEffect(() => {
    if (!user || !firestore || !sessionId || !session) return;

    const participantRef = doc(
      firestore,
      'sessions',
      sessionId,
      'sessionParticipants',
      user.uid
    );

    setDoc(participantRef, {
      userId: user.uid,
      sessionId: sessionId,
      joinedAt: serverTimestamp(),
      displayName: user.displayName,
      photoURL: user.photoURL,
    });

    return () => {
      deleteDoc(participantRef);
    };
  }, [user, firestore, sessionId, session]);

  const handleSongChange = async (newSongId: string) => {
    if (!sessionRef || !isHost) return;

    try {
      await updateDoc(sessionRef, { songId: newSongId, scroll: 0 });
      const newDoc = allDocuments?.find((d) => d.id === newSongId);
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

  if (sessionLoading || docsLoading || participantsLoading || currentDocLoading) {
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
            <Link href="/library">
              <ArrowLeft />
              <span className="sr-only">Zurück zur Bibliothek</span>
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <div className="hidden sm:block">
              {isHost ? (
                <Select
                  onValueChange={handleSongChange}
                  value={session.songId}
                  disabled={!allDocuments || allDocuments.length === 0}
                >
                  <SelectTrigger className="w-auto md:w-[300px] font-semibold text-lg">
                    <SelectValue placeholder="Wähle ein Dokument..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allDocuments?.map((doc) => (
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Users className="h-5 w-5" />
                {participants && participants.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                    {participants.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64">
              <div className="font-bold mb-2">
                Aktive Nutzer ({participants?.length || 0})
              </div>
              <ul className="space-y-3 max-h-60 overflow-y-auto">
                {participantsLoading ? (
                  <li>
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </li>
                ) : (
                  participants?.map((p) => (
                    <li key={p.id} className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {p.photoURL && (
                          <AvatarImage
                            src={p.photoURL}
                            alt={p.displayName || ''}
                          />
                        )}
                        <AvatarFallback>
                          {p.displayName
                            ? p.displayName.charAt(0).toUpperCase()
                            : 'A'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">
                        {p.displayName || 'Anonymer Nutzer'}
                      </span>
                    </li>
                  ))
                )}
                {!participantsLoading && participants?.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Niemand sonst ist hier.
                  </p>
                )}
              </ul>
            </PopoverContent>
          </Popover>

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
          <UserNav />
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {currentDocument && sessionId && sessionRef && (
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
