'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
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
  QrCode,
  Plus,
  Minus,
} from 'lucide-react';
import QRCode from 'react-qr-code';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import SongViewer from '@/components/song-viewer';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import {
  useDoc,
  useUser,
  useCollection,
  useFirebase,
  useMemoFirebase,
  errorEmitter,
  FirestorePermissionError,
} from '@/firebase';
import type { Session, Song, SessionParticipant } from '@/lib/types';
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
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [sessionUrl, setSessionUrl] = useState('');
  
  useEffect(() => {
    // Ensure this runs only on the client
    setSessionUrl(window.location.href);
  }, []);

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

  // Global songs for the host's dropdown
  const allSongsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'songs') : null),
    [firestore]
  );
  const { data: allSongs, loading: songsLoading } =
    useCollection<Song>(allSongsRef);

  // Current song for the session
  const currentSongRef = useMemoFirebase(
    () =>
      firestore && session?.songId
        ? doc(firestore, 'songs', session.songId)
        : null,
    [firestore, session?.songId]
  );
  const { data: currentSong, loading: currentSongLoading } =
    useDoc<Song>(currentSongRef);

  // Effect to handle session errors (like permissions)
  useEffect(() => {
    if (sessionError) {
      toast({
        variant: 'destructive',
        title: 'Fehler bei der Sitzung',
        description: 'Auf diese Sitzung konnte nicht zugegriffen werden.',
      });
      router.push('/');
    }
  }, [sessionError, router, toast]);

  // Effect to handle the "not found" case with a grace period
  useEffect(() => {
    if (initialCheckComplete && !session) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description:
          'Sitzung nicht gefunden. Bitte überprüfe die ID und versuche es erneut.',
      });
      router.push('/');
    }
  }, [session, initialCheckComplete, router, toast]);

  // Timer to manage the grace period for session loading
  useEffect(() => {
    if (!sessionLoading) {
      const timer = setTimeout(() => {
        setInitialCheckComplete(true);
      }, 1500); // 1.5s grace period
      return () => clearTimeout(timer);
    }
  }, [sessionLoading]);


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
    const participantData = {
      userId: user.uid,
      sessionId: sessionId,
      joinedAt: serverTimestamp(),
      displayName: user.displayName,
      photoURL: user.photoURL,
    };

    setDoc(participantRef, participantData).catch(async (serverError) => {
      if (serverError.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
          path: participantRef.path,
          operation: 'create',
          requestResourceData: participantData,
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        console.error('Failed to join session:', serverError);
      }
    });

    return () => {
      deleteDoc(participantRef).catch(async (serverError) => {
        if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: participantRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          // This might fire benignly on page unload, so we don't show a toast.
          console.error('Failed to leave session:', serverError);
        }
      });
    };
  }, [user, firestore, sessionId, session]);

  const handleSongChange = async (newSongId: string) => {
    if (!sessionRef || !isHost) return;

    try {
      // Reset transpose when song changes
      await updateDoc(sessionRef, { songId: newSongId, scroll: 0, transpose: 0, lastActivity: serverTimestamp() });
      const newDoc = allSongs?.find((d) => d.id === newSongId);
      toast({
        title: 'Song gewechselt',
        description: `Neuer Song: ${newDoc?.title}`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Konnte den Song nicht wechseln.',
      });
    }
  };

  const handleTranspose = async (amount: number) => {
    if (!sessionRef || !isHost || session === null) return;

    const newTranspose = (session.transpose || 0) + amount;
    const updateData = { 
      transpose: newTranspose,
      lastActivity: serverTimestamp() 
    };

    try {
      await updateDoc(sessionRef, updateData);
    } catch (error: any) {
      console.error("Failed to update transpose value:", error);
      if (error.code === 'permission-denied') {
         const permissionError = new FirestorePermissionError({
            path: sessionRef.path,
            operation: 'update',
            requestResourceData: updateData,
          });
          errorEmitter.emit('permission-error', permissionError);
      } else {
        toast({
            variant: "destructive",
            title: "Fehler",
            description: "Transponierung konnte nicht geändert werden.",
        });
      }
    }
  };

  const copyUrlToClipboard = () => {
    if (sessionUrl) {
      navigator.clipboard.writeText(sessionUrl);
      toast({
        title: 'Kopiert!',
        description: 'Sitzungs-Link wurde in die Zwischenablage kopiert.',
      });
    }
  };

  const showLoading =
    sessionLoading ||
    participantsLoading ||
    songsLoading ||
    currentSongLoading ||
    !initialCheckComplete;

  if (showLoading && !session) {
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
                  disabled={!allSongs || allSongs.length === 0}
                >
                  <SelectTrigger className="w-auto md:w-[300px] font-semibold text-lg">
                    <SelectValue placeholder="Wähle einen Song..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allSongs?.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="font-semibold text-lg">
                  {currentSong?.title || 'SyncScroll'}
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
                          {p.isAnonymous ? 'A' : (p.displayName
                            ? p.displayName.charAt(0).toUpperCase()
                            : 'U')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">
                        {p.isAnonymous ? `Anonym (${p.id.substring(0,4)})` : (p.displayName || 'Anonymer Nutzer')}
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

          {isHost && (
            <div className="flex items-center gap-1 rounded-md bg-muted p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleTranspose(-1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="font-mono text-sm font-semibold w-8 text-center">
                {(session?.transpose || 0) > 0
                  ? `+${session?.transpose}`
                  : session?.transpose || 0}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleTranspose(1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

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
           <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <QrCode className="mr-2 h-4 w-4" />
                Teilen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Sitzung teilen</DialogTitle>
                <DialogDescription>
                  Andere können den QR-Code scannen oder den Link verwenden, um
                  sofort beizutreten.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center justify-center pt-4 gap-4">
                {sessionUrl ? (
                  <QRCode value={sessionUrl} size={200} />
                ) : (
                  <div className="h-[200px] w-[200px] flex items-center justify-center bg-muted rounded-md">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
                <div className="flex items-center w-full space-x-2">
                  <Input value={sessionUrl} readOnly className="flex-1" />
                  <Button
                    onClick={copyUrlToClipboard}
                    size="icon"
                    variant="outline"
                  >
                    <span className="sr-only">Link kopieren</span>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <UserNav />
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {currentSong && sessionRef && session && (
          <SongViewer
            song={currentSong}
            sessionId={sessionId}
            isHost={isHost}
            sessionRef={sessionRef}
            initialScroll={session.scroll}
            transpose={session.transpose || 0}
          />
        )}
         {!currentSong && !currentSongLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Music className="h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">Kein Song ausgewählt</h2>
            {isHost ? (
              <p className="mt-2 text-muted-foreground">Bitte wählen Sie oben einen Song aus, um die Session zu starten.</p>
            ) : (
              <p className="mt-2 text-muted-foreground">Der Host hat noch keinen Song für diese Session ausgewählt.</p>
            )}
          </div>
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
