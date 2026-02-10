'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Music,
  Trash2,
  PlusCircle,
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
import type { Song, SongSheet, SongPart, UserProfile } from '@/lib/types';
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

// This new, more robust parser converts the complex Songsterr player data into our app's format
function parseSongsterrToSheet(songsterrData: any): SongSheet {
    const track = songsterrData.song.track;
    if (!track) throw new Error("Song data does not contain a track.");

    const sheet: SongSheet = {
        releaseDate: String(songsterrData.song.year || ""),
        genre: songsterrData.song.genres?.[0]?.name || "",
        key: "", // Not available in songsterr data
        song: [],
    };

    let currentPart: SongPart | null = null;
    
    // This array will hold fragments of { chord: 'Am', text: 'ly-ric' }
    let lineFragments: { chord: string | null, text: string }[] = [];

    const finalizeLine = () => {
        if (!currentPart || lineFragments.length === 0) {
            lineFragments = [];
            return;
        }

        const chordLine = lineFragments.map(f => (f.chord || '').padEnd(f.text.length)).join('');
        const textLine = lineFragments.map(f => f.text).join('');

        if (textLine.trim()) {
            currentPart.lines.push({ chords: chordLine, text: textLine });
        }
        lineFragments = [];
    };

    for (const measure of track.measure) {
        if (measure.marker) {
            finalizeLine(); // Finalize previous line before starting a new part
            
            currentPart = { part: measure.marker.title, lines: [] };
            sheet.song.push(currentPart);
        }

        if (!currentPart) continue;
      
        for (const voice of measure.voice) {
            for (const beat of voice.beat) {
                const chord = beat.chord?.name || null;
                const lyrics = beat.voice?.lyrics?.text || "";
                
                if (chord && lineFragments.length > 0 && lineFragments[lineFragments.length - 1].chord) {
                    // If the last fragment already has a chord, this new chord belongs to an empty text fragment
                    lineFragments.push({ chord: chord, text: '' });
                }

                const lyricParts = lyrics.split('\r');

                lyricParts.forEach((lyricPart, index) => {
                    if (index > 0) { // Newline was found
                        finalizeLine();
                    }

                    if (lyricPart) {
                        const lastFragment = lineFragments[lineFragments.length - 1];
                        if (chord && lineFragments.length > 0 && !lastFragment.chord) {
                           // If there's a pending chord and the last fragment doesn't have one, assign it
                           lastFragment.chord = chord;
                           lastFragment.text += lyricPart;
                        } else {
                           lineFragments.push({ chord: chord, text: lyricPart });
                        }
                    } else if (chord && index === 0) { // Chord with no lyric
                        lineFragments.push({ chord: chord, text: '' });
                    }
                });
            }
        }
    }

    finalizeLine(); // Add any remaining line

    // Filter out empty parts
    sheet.song = sheet.song.filter(part => part.lines.some(line => line.text.trim()));

    return sheet;
}


function LibraryPage() {
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isImporting, setIsImporting] = useState(false);
  const [importingInfo, setImportingInfo] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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

  // Debounce Songsterr Search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = encodeURIComponent(searchQuery);
        // Use our own API proxy route to avoid CORS issues
        const response = await fetch(
          `/api/songsterr/songs.json?pattern=${searchTerm}`
        );
        if (!response.ok) throw new Error('Songsterr API request failed');
        const data = await response.json();
        setSearchResults(data || []);
      } catch (error) {
        console.error('Songsterr search failed:', error);
        toast({
          variant: 'destructive',
          title: 'Suche fehlgeschlagen',
          description: 'Die Suche nach Songs bei Songsterr ist fehlgeschlagen.',
        });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, toast]);

  const importFromSongsterr = async (song: any) => {
    if (!user || !firestore || !userProfileRef) return;

    setIsImporting(true);
    setImportingInfo(song);
    setSearchQuery('');
    setSearchResults([]);

    try {
      // 1. Fetch detailed song data from Songsterr via our proxy
      const playerResponse = await fetch(`/api/songsterr/player/song/${song.id}.json`);
      if (!playerResponse.ok) throw new Error('Failed to fetch song details from Songsterr.');
      const songsterrData = await playerResponse.json();
      
      // 2. Parse the complex data into our simple sheet format
      const sheet = parseSongsterrToSheet(songsterrData);

      if (!sheet || !sheet.song || sheet.song.length === 0) {
        throw new Error('Songsterr data could not be parsed into a valid sheet.');
      }

      // 3. (Optional) Fetch artwork from iTunes for a better UI
      let artworkUrl: string | undefined = undefined;
      try {
        const searchTerm = encodeURIComponent(`${song.artist.name} ${song.title}`);
        const itunesResponse = await fetch(`https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1`);
        if (itunesResponse.ok) {
          const itunesData = await itunesResponse.json();
          if (itunesData.resultCount > 0 && itunesData.results[0].artworkUrl100) {
            artworkUrl = itunesData.results[0].artworkUrl100.replace('100x100', '400x400');
          }
        }
      } catch (e) {
        console.warn('Could not fetch artwork from iTunes', e);
      }

      // 4. Save the new song to Firestore
      const songsCollectionRef = collection(firestore, 'songs');
      await addDoc(songsCollectionRef, {
        userId: user.uid,
        creatorName: user.displayName || user.email || 'Anonym',
        title: song.title,
        artist: song.artist.name,
        sheet: sheet,
        createdAt: serverTimestamp(),
        artworkUrl: artworkUrl || null,
      });

      // 5. Update generation count for creators
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
        title: 'Song importiert & gespeichert',
        description: `"${song.title}" von ${song.artist.name} wurde zur Bibliothek hinzugefügt.`,
      });

    } catch (error: any) {
      console.error('Processing Error: ', error);
      toast({
        variant: 'destructive',
        title: 'Import fehlgeschlagen',
        description: error.message || 'Das Song-Sheet konnte nicht importiert werden.',
      });
    } finally {
      setIsImporting(false);
      setImportingInfo(null);
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
                Neuen Song von Songsterr importieren
              </CardTitle>
              <CardDescription>
                Suche nach einem Song und wähle ihn aus, um ein
                Song-Sheet zu erstellen.
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
                {importingInfo ? (
                  <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                     <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center bg-secondary rounded-md">
                        <Music className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">
                        {importingInfo.title}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {importingInfo.artist.name}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-sm text-primary">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Song-Sheet wird importiert...</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="song-search">Songsterr-Suche</Label>
                      <Input
                        id="song-search"
                        placeholder="z.B. Hotel California, Eagles"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={isImporting}
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
                            <li key={song.id}>
                              <button
                                className="w-full text-left p-3 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-4"
                                onClick={() => importFromSongsterr(song)}
                                disabled={isImporting}
                              >
                                <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center bg-muted rounded-md text-muted-foreground">
                                    <Music className="h-6 w-6" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                  <div className="font-semibold truncate">
                                    {song.title}
                                  </div>
                                  <div className="text-sm text-muted-foreground truncate">
                                    {song.artist.name}
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
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
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
                Importieren Sie Ihren ersten Song, um zu beginnen.
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
