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
  QrCode,
  Plus,
  Minus,
  Pencil,
  Save,
  X,
  ChevronsUpDown,
  Check,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import { cloneDeep } from 'lodash';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import SongViewer from '@/components/song-viewer';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import type { Session, Song, SongSheet, UserProfile } from '@/lib/types';
import {
  doc,
  updateDoc,
  collection,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { UserNav } from '@/components/user-nav';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';

const FONT_SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];

function SessionPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [sessionUrl, setSessionUrl] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [editedSheet, setEditedSheet] = useState<SongSheet | null>(null);
  const [showChords, setShowChords] = useState(false); // Default to false for guests
  const [songSelectorOpen, setSongSelectorOpen] = useState(false);
  const [songSearch, setSongSearch] = useState('');
  const [fontSizeIndex, setFontSizeIndex] = useState(2); // default to 'text-lg'

  useEffect(() => {
    const savedSizeIndex = localStorage.getItem('song-viewer-font-size-index');
    if (savedSizeIndex) {
      setFontSizeIndex(Number(savedSizeIndex));
    }
  }, []);

  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;

  useEffect(() => {
    // Ensure this runs only on the client and uses the custom domain
    setSessionUrl(`https://qkqk.de/session/${sessionId}`);
  }, [sessionId]);
  
  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, loading: userProfileLoading } = useDoc<UserProfile>(userProfileRef);

  const sessionRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'sessions', sessionId) : null),
    [firestore, sessionId]
  );
  const {
    data: session,
    loading: sessionLoading,
    error: sessionError,
  } = useDoc<Session>(sessionRef);

  const isHost = session?.hostId === user?.uid;
  const canChangeSong = isHost || userProfile?.role === 'admin' || userProfile?.role === 'creator';

  // Set showChords to true for the host, and false by default for guests.
  useEffect(() => {
    if (session && user) { // ensure data is loaded
      if (session.hostId === user.uid) {
        setShowChords(true);
      }
    }
  }, [session, user]);

  // Global songs for the host's dropdown
  const allSongsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'songs') : null),
    [firestore]
  );
  const { data: allSongs, loading: songsLoading } =
    useCollection<Song>(allSongsRef);

  const filteredSongs = useMemo(() => {
    if (!allSongs) return [];
    const query = songSearch.toLowerCase();
    if (!query) return allSongs;
    return allSongs.filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query)
    );
  }, [allSongs, songSearch]);

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

  // Sync editedSheet when current song changes
  useEffect(() => {
    if (currentSong?.sheet) {
      setEditedSheet(cloneDeep(currentSong.sheet));
    }
  }, [currentSong]);

  const handleSongChange = async (newSongId: string) => {
    if (!sessionRef || !canChangeSong) return;

    try {
      // Reset transpose when song changes
      await updateDoc(sessionRef, {
        songId: newSongId,
        scroll: 0,
        transpose: 0,
        lastActivity: serverTimestamp(),
      });
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

  const handleTranspose = (amount: number) => {
    if (!sessionRef || !isHost || session === null) return;

    const newTranspose = (session.transpose || 0) + amount;
    const updateData = {
      transpose: newTranspose,
      lastActivity: serverTimestamp(),
    };

    updateDoc(sessionRef, updateData).catch(async (error: any) => {
      console.error('Failed to update transpose value:', error);
      if (error.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
          path: sessionRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
      } else {
        toast({
          variant: 'destructive',
          title: 'Fehler',
          description: 'Transponierung konnte nicht geändert werden.',
        });
      }
    });
  };

  const handleFontSizeChange = (amount: number) => {
    const newIndex = Math.max(
      0,
      Math.min(FONT_SIZES.length - 1, fontSizeIndex + amount)
    );
    setFontSizeIndex(newIndex);
    localStorage.setItem('song-viewer-font-size-index', String(newIndex));
  };

  const handleSaveEdits = async () => {
    if (!isHost || !currentSongRef || !editedSheet) return;
    try {
      await updateDoc(currentSongRef, { sheet: editedSheet });
      toast({
        title: 'Gespeichert',
        description: 'Änderungen am Song-Sheet wurden gespeichert.',
      });
      setIsEditing(false);
    } catch (error: any) {
      console.error('Failed to save song sheet:', error);
      toast({
        variant: 'destructive',
        title: 'Speichern fehlgeschlagen',
        description:
          error.message || 'Die Änderungen konnten nicht gespeichert werden.',
      });
    }
  };

  const handleCancelEdit = () => {
    if (currentSong?.sheet) {
      setEditedSheet(cloneDeep(currentSong.sheet));
    }
    setIsEditing(false);
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
    userProfileLoading ||
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
      <header className="flex flex-col gap-y-3 p-3 border-b shrink-0">
        {/* Top Row: Back button and main controls */}
        <div className="flex w-full items-center justify-between gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/">
              <ArrowLeft />
              <span className="sr-only">Zurück zur Startseite</span>
            </Link>
          </Button>
          <div className="flex items-center justify-end flex-wrap gap-x-2 sm:gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <Switch
                id="show-chords"
                checked={showChords}
                onCheckedChange={setShowChords}
                disabled={isEditing}
              />
              <Label htmlFor="show-chords" className="text-sm hidden sm:block">
                Akkorde
              </Label>
            </div>

            {!isEditing && (
              <div className="hidden md:flex items-center gap-1 rounded-md bg-muted p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleFontSizeChange(-1)}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="font-mono text-sm font-semibold w-8 text-center">
                  Aa
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleFontSizeChange(1)}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            )}

            {isHost && (
              <div className="flex items-center gap-1">
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      className="h-8 w-8 bg-green-600 hover:bg-green-700"
                      onClick={handleSaveEdits}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Separator orientation="vertical" className="h-5 mx-1" />
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
                    Andere können den QR-Code scannen oder den Link verwenden,
                    um sofort beizutreten.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center pt-4 gap-4">
                  {sessionUrl ? (
                    <div className="p-4 bg-white rounded-lg">
                      <QRCode value={sessionUrl} size={200} />
                    </div>
                  ) : (
                    <div className="h-[232px] w-[232px] flex items-center justify-center bg-muted rounded-md">
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
        </div>

        {/* Middle Row: Song Selector */}
        <div className="flex w-full items-center gap-2">
          <Music className="h-6 w-6 text-primary" />
          <div className="block flex-1 min-w-0">
            {canChangeSong ? (
              <Popover
                open={songSelectorOpen}
                onOpenChange={setSongSelectorOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={songSelectorOpen}
                    className="w-full justify-between h-auto p-2 text-left"
                    disabled={!allSongs || allSongs.length === 0 || isEditing}
                  >
                    <div className="flex items-center gap-3 w-full">
                      {currentSong?.artworkUrl ? (
                        <Image
                          src={currentSong.artworkUrl}
                          alt={currentSong.title}
                          width={32}
                          height={32}
                          className="rounded-sm object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-muted rounded-sm text-muted-foreground">
                          <Music className="h-5 w-5" />
                        </div>
                      )}
                      <div className="overflow-hidden flex-1">
                        <div className="font-semibold text-lg truncate leading-tight">
                          {currentSong?.title ?? 'Wähle einen Song...'}
                        </div>
                        {currentSong?.artist && (
                          <div className="text-sm text-muted-foreground truncate">
                            {currentSong.artist}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Song suchen..."
                      value={songSearch}
                      onChange={(e) => setSongSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto p-1">
                    {filteredSongs.length === 0 ? (
                      <p className="p-2 text-center text-sm text-muted-foreground">
                        Kein Song gefunden.
                      </p>
                    ) : (
                      filteredSongs.map((songItem) => (
                        <Button
                          key={songItem.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-2 text-left"
                          onClick={() => {
                            handleSongChange(songItem.id);
                            setSongSelectorOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-3 w-full">
                            {songItem.artworkUrl ? (
                              <Image
                                src={songItem.artworkUrl}
                                alt={songItem.title}
                                width={32}
                                height={32}
                                className="rounded-sm object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 flex items-center justify-center bg-muted rounded-sm text-muted-foreground flex-shrink-0">
                                <Music className="h-4 w-4" />
                              </div>
                            )}
                            <div className="flex-1 overflow-hidden">
                              <div className="font-medium truncate">
                                {songItem.title}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {songItem.artist}
                              </div>
                            </div>
                            {session.songId === songItem.id && (
                              <Check className="ml-auto h-4 w-4" />
                            )}
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="flex items-center gap-3 w-full">
                {currentSong?.artworkUrl ? (
                  <Image
                    src={currentSong.artworkUrl}
                    alt={currentSong.title}
                    width={32}
                    height={32}
                    className="rounded-sm object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-muted rounded-sm text-muted-foreground">
                    <Music className="h-5 w-5" />
                  </div>
                )}
                <div className="overflow-hidden flex-1">
                  <div className="font-semibold text-lg truncate leading-tight">
                    {currentSong?.title || 'SyncScroll'}
                  </div>
                  {currentSong?.artist && (
                    <div className="text-sm text-muted-foreground truncate">
                      {currentSong.artist}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom Row: Mobile-only font size controls */}
        {!isEditing && (
            <div className="md:hidden flex items-center gap-1 rounded-md bg-muted p-1 self-center">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleFontSizeChange(-1)}
                >
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="font-mono text-sm font-semibold w-8 text-center">
                    Aa
                </span>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleFontSizeChange(1)}
                >
                    <ZoomIn className="h-4 w-4" />
                </Button>
            </div>
        )}
      </header>
      <main className="flex-1 overflow-hidden">
        {currentSong && sessionRef && session && editedSheet && (
          <SongViewer
            key={currentSong.id} // Re-mount when song changes
            song={currentSong}
            sessionId={sessionId}
            isHost={isHost}
            sessionRef={sessionRef}
            initialScroll={session.scroll}
            transpose={session.transpose || 0}
            isEditing={isEditing}
            sheet={editedSheet}
            onSheetChange={setEditedSheet}
            showChords={showChords}
            fontSize={FONT_SIZES[fontSizeIndex]}
          />
        )}
        {!currentSong && !currentSongLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Music className="h-16 w-16 text-muted-foreground/50" />
            <h2 className="mt-4 text-xl font-semibold">Kein Song ausgewählt</h2>
            {isHost ? (
              <p className="mt-2 text-muted-foreground">
                Bitte wählen Sie oben einen Song aus, um die Session zu
                starten.
              </p>
            ) : (
              <p className="mt-2 text-muted-foreground">
                Der Host hat noch keinen Song für diese Session ausgewählt.
              </p>
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
