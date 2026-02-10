'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Music,
  Trash2,
  LogIn,
  Loader2,
  Share2,
  Library as LibraryIcon,
  Sparkles,
  Pencil,
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
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import {
  useUser,
  useCollection,
  useFirebase,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { Song, SongSheet, UserProfile } from '@/lib/types';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

import { UserNav } from '@/components/user-nav';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generateSongSheet } from '@/ai/flows/generate-song-sheet-flow';

const MUSIC_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function LibraryPage() {
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Generation flow state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const [generationInfo, setGenerationInfo] = useState<{
    title: string;
    artist: string;
    artworkUrl?: string;
  } | null>(null);
  const [lyrics, setLyrics] = useState('');
  const [selectedKey, setSelectedKey] = useState('C');
  const [generationStep, setGenerationStep] = useState<'loading' | 'input'>(
    'loading'
  );

  // Session dialog state
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, loading: userProfileLoading } =
    useDoc<UserProfile>(userProfileRef);

  const songsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'songs') : null),
    [firestore]
  );
  const {
    data: songs,
    loading: songsLoading,
    error,
  } = useCollection<Song>(songsRef);

  // Debounced iTunes Search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = encodeURIComponent(searchQuery);
        const response = await fetch(
          `https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=10`
        );
        if (!response.ok) throw new Error('iTunes API request failed');
        const data = await response.json();
        setSearchResults(data.results || []);
      } catch (error) {
        console.error('iTunes search failed:', error);
        toast({
          variant: 'destructive',
          title: 'Suche fehlgeschlagen',
          description: 'Die Suche nach Songs ist fehlgeschlagen.',
        });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, toast]);

  const handleSelectSong = async (song: any) => {
    setGenerationInfo({
      title: song.trackName,
      artist: song.artistName,
      artworkUrl: song.artworkUrl100?.replace('100x100', '400x400'),
    });
    setGenerationDialogOpen(true);
    setGenerationStep('loading');
    setSearchQuery('');
    setSearchResults([]);

    try {
      // Fetch lyrics from proxy
      const lyricsResponse = await fetch(
        `/api/lyrics/${encodeURIComponent(
          song.artistName
        )}/${encodeURIComponent(song.trackName)}`
      );
      if (lyricsResponse.ok) {
        const data = await lyricsResponse.json();
        if (data.lyrics) {
          setLyrics(data.lyrics);
        } else {
          // If API returns ok but no lyrics, prompt user
          setLyrics('');
        }
      } else {
        // If API fails, prompt user
        setLyrics('');
      }
    } catch (e) {
      console.error('Lyrics fetch error', e);
      setLyrics(''); // Ensure we prompt user on error
    } finally {
      setGenerationStep('input');
    }
  };

  const handleGenerateSheet = async () => {
    if (!user || !firestore || !generationInfo || !lyrics || !selectedKey) {
      toast({
        variant: 'destructive',
        title: 'Fehlende Informationen',
        description: 'Bitte füllen Sie alle Felder aus.',
      });
      return;
    }
    
    if (!userProfileRef) return;

    setIsGenerating(true);

    try {
      const sheet = await generateSongSheet({
        artist: generationInfo.artist,
        title: generationInfo.title,
        lyrics: lyrics,
        key: selectedKey,
      });

      const songsCollectionRef = collection(firestore, 'songs');
      await addDoc(songsCollectionRef, {
        userId: user.uid,
        creatorName: user.displayName || user.email || 'Anonym',
        title: generationInfo.title,
        artist: generationInfo.artist,
        sheet: { ...sheet, key: selectedKey }, // Ensure the selected key is saved
        createdAt: serverTimestamp(),
        artworkUrl: generationInfo.artworkUrl || null,
      });

      if (userProfile?.role === 'creator') {
        const today = new Date().toISOString().split('T')[0];
        const newCount =
          userProfile.lastGenerationDate === today
            ? (userProfile.songsGeneratedToday || 0) + 1
            : 1;
        await updateDoc(userProfileRef, {
          songsGeneratedToday: newCount,
          lastGenerationDate: today,
        });
      }

      toast({
        title: 'Song generiert & gespeichert',
        description: `"${generationInfo.title}" wurde zur Bibliothek hinzugefügt.`,
      });

      setGenerationDialogOpen(false);
    } catch (error: any) {
      console.error('Generation Error: ', error);
      toast({
        variant: 'destructive',
        title: 'Generierung fehlgeschlagen',
        description:
          error.message || 'Das Song-Sheet konnte nicht erstellt werden.',
      });
    } finally {
      setIsGenerating(false);
      setLyrics('');
      setGenerationInfo(null);
    }
  };

  const handleDelete = async (songToDelete: Song) => {
    if (
      !firestore ||
      !user ||
      (user.uid !== songToDelete.userId &&
        userProfile?.role !== 'admin' &&
        userProfile?.role !== 'superadmin')
    )
      return;
    try {
      const docRef = doc(firestore, 'songs', songToDelete.id);
      await deleteDoc(docRef);

      toast({
        title: 'Song gelöscht',
        description: `"${songToDelete.title}" wurde entfernt.`,
      });
    } catch (error: any) {
      console.error('Delete Error:', error);
      toast({
        variant: 'destructive',
        title: 'Löschen fehlgeschlagen',
        description: 'Der Song konnte nicht gelöscht werden.',
      });
    }
  };

  const createSession = async (songId: string) => {
    if (!user || !firestore) return;

    const sessionId = Math.random().toString(36).substring(2, 6).toUpperCase();

    try {
      const sessionCollection = collection(firestore, 'sessions');
      await setDoc(doc(sessionCollection, sessionId), {
        id: sessionId,
        hostId: user.uid,
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

  if (userLoading || userProfileLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (
    !user ||
    !userProfile ||
    (userProfile.role !== 'creator' &&
      userProfile.role !== 'admin' &&
      userProfile.role !== 'superadmin')
  ) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-center p-4">
        <LibraryIcon className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold">Zugriff verweigert</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          Sie müssen ein "Creator" oder "Admin" sein, um die Bibliothek zu
          sehen.
        </p>
        <Button onClick={() => router.push('/')}>
          <LogIn className="mr-2" />
          Zurück zur Startseite
        </Button>
      </div>
    );
  }

  const canGenerate =
    userProfile?.role === 'creator' ||
    userProfile?.role === 'admin' ||
    userProfile?.role === 'superadmin';

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 sm:p-6 flex justify-between items-center border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => router.push('/')}
        >
          <LibraryIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Songs</h1>
        </div>
        <div className="flex items-center gap-4">
          {canGenerate && (
            <Dialog
              open={isSessionDialogOpen}
              onOpenChange={setIsSessionDialogOpen}
            >
              <DialogTrigger asChild>
                <Button>
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
                    <Select onValueChange={setSelectedSongId}>
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
                  >
                    Session jetzt starten
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <UserNav />
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {canGenerate && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles />
                Neuen Song mit KI generieren
              </CardTitle>
              <CardDescription>
                Suche nach einem Song, um Texte zu finden und Akkorde mit
                KI zu generieren.
                {userProfile?.role === 'creator' &&
                  ` (${
                    5 -
                    ((userProfile.lastGenerationDate ===
                    new Date().toISOString().split('T')[0]
                      ? userProfile.songsGeneratedToday
                      : 0) || 0)
                  }/5 heute übrig)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="song-search">iTunes-Suche</Label>
                  <Input
                    id="song-search"
                    placeholder="z.B. Hotel California, Eagles"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>

                {isSearching && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && (
                  <div className="border rounded-md max-h-72 overflow-y-auto">
                    <ul className="divide-y">
                      {searchResults.map((song) => (
                        <li key={song.trackId}>
                          <button
                            className="w-full text-left p-3 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-4"
                            onClick={() => handleSelectSong(song)}
                            disabled={isGenerating}
                          >
                            <Image
                              src={song.artworkUrl100}
                              alt={song.trackName}
                              width={48}
                              height={48}
                              className="rounded-md"
                            />
                            <div className="flex-1 overflow-hidden">
                              <div className="font-semibold truncate">
                                {song.trackName}
                              </div>
                              <div className="text-sm text-muted-foreground truncate">
                                {song.artistName}
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!isSearching &&
                  searchQuery &&
                  searchResults.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center p-4">
                      Keine Ergebnisse gefunden.
                    </p>
                  )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Generation Dialog */}
        <Dialog
          open={generationDialogOpen}
          onOpenChange={setGenerationDialogOpen}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Song-Blatt generieren</DialogTitle>
              <DialogDescription>
                Wählen Sie eine Tonart und bestätigen Sie den Text, um die Akkorde zu generieren.
              </DialogDescription>
            </DialogHeader>
            {generationStep === 'loading' ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="key" className="text-right">
                    Tonart
                  </Label>
                  <Select value={selectedKey} onValueChange={setSelectedKey}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Tonart auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {MUSIC_KEYS.map(key => (
                        <SelectItem key={key} value={key}>{key}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="lyrics" className="text-right pt-2">
                    Songtext
                  </Label>
                  <Textarea
                    id="lyrics"
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    className="col-span-3 min-h-[200px]"
                    placeholder="Songtext hier einfügen, falls er nicht automatisch gefunden wurde."
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setGenerationDialogOpen(false)}
                disabled={isGenerating}
              >
                Abbrechen
              </Button>
              <Button onClick={handleGenerateSheet} disabled={isGenerating || !lyrics}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generieren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        <div>
          <h2 className="text-2xl font-bold mb-4">Alle Songs</h2>
          {songsLoading && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] p-2"></TableHead>
                    <TableHead>Song</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Erstellt am</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="p-2">
                        <Skeleton className="h-10 w-10 rounded-sm" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2 mt-1" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-2/3" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-3/4" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-9 w-9 inline-block" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {error && (
            <p className="text-destructive">
              Fehler beim Laden der Songs: {error.message}
            </p>
          )}
          {!songsLoading && songs && songs.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <Music className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">
                Keine Songs gefunden
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Generieren Sie Ihren ersten Song, um zu beginnen.
              </p>
            </div>
          )}
          {!songsLoading && songs && songs.length > 0 && (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] p-2"></TableHead>
                    <TableHead className="w-[40%]">Song</TableHead>
                    <TableHead className="w-[25%]">Creator</TableHead>
                    <TableHead className="w-[20%]">Erstellt am</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {songs?.map((songItem) => (
                    <TableRow key={songItem.id}>
                      <TableCell className="p-2">
                        {songItem.artworkUrl ? (
                          <Image
                            src={songItem.artworkUrl}
                            alt={songItem.title}
                            width={40}
                            height={40}
                            className="rounded-sm object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-sm text-muted-foreground">
                            <Music className="h-5 w-5" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{songItem.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {songItem.artist}
                        </div>
                      </TableCell>
                      <TableCell>
                        {songItem.creatorName || 'Unbekannt'}
                      </TableCell>
                      <TableCell>
                        {songItem.createdAt?.toDate
                          ? format(songItem.createdAt.toDate(), 'dd.MM.yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Bearbeiten"
                          onClick={() => router.push(`/library/${songItem.id}`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {(user?.uid === songItem.userId ||
                          userProfile?.role === 'admin' ||
                          userProfile?.role === 'superadmin') && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Löschen</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Sind Sie sicher?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Diese Aktion kann nicht rückgängig gemacht
                                  werden. Dadurch wird das Song-Sheet dauerhaft
                                  gelöscht.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(songItem)}
                                >
                                  Löschen
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Library() {
  return (
    <FirebaseClientProvider>
      <LibraryPage />
    </FirebaseClientProvider>
  );
}
