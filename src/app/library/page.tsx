'use client';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Music,
  LogIn,
  Loader2,
  Share2,
  Library as LibraryIcon,
  Sparkles,
  User,
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
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import type { Song, SongSheet, UserProfile, Session } from '@/lib/types';
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { UserNav } from '@/components/user-nav';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { generateSongSheet } from '@/ai/flows/generate-song-sheet-flow';

const MAJOR_KEYS = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];
const MINOR_KEYS = [
  'Am',
  'A#m',
  'Bm',
  'Cm',
  'C#m',
  'Dm',
  'D#m',
  'Em',
  'Fm',
  'F#m',
  'Gm',
  'G#m',
];

function SongCard({ song }: { song: Song }) {
  const router = useRouter();
  const hasArtwork = !!song.artworkUrl;

  return (
    <Card
      onClick={() => router.push(`/library/${song.id}`)}
      className="flex flex-col group relative overflow-hidden cursor-pointer"
    >
      {hasArtwork && (
        <div className="absolute top-0 right-0 h-full w-1/2 opacity-40 group-hover:opacity-60 transition-opacity duration-300">
          <Image
            src={song.artworkUrl!}
            alt=""
            fill
            className="object-cover"
            sizes="50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/50 to-background" />
        </div>
      )}
      <CardHeader className="relative flex-grow">
        <div>
          <CardTitle className="truncate leading-tight text-lg">
            {song.title || 'Unbekannter Song'}
          </CardTitle>
          <CardDescription className="mt-1">
            {song.artist || ' '}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-shrink-0 text-sm pt-0 relative">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="truncate">{song.creatorName || 'Unbekannt'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function LibraryPage() {
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  // Search state for iTunes
  const [itunesSearchQuery, setItunesSearchQuery] = useState('');
  const [itunesSearchResults, setItunesSearchResults] = useState<any[]>([]);
  const [isSearchingItunes, setIsSearchingItunes] = useState(false);

  // Search state for local library
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

  // Generation flow state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const [manualAddDialogOpen, setManualAddDialogOpen] = useState(false);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [generationInfo, setGenerationInfo] = useState<{
    title: string;
    artist: string;
    artworkUrl?: string;
  } | null>(null);
  const [lyrics, setLyrics] = useState('');
  const [selectedKey, setSelectedKey] = useState('C');
  const [manualForm, setManualForm] = useState({
    title: '',
    artist: '',
    lyrics: '',
    key: 'C',
  });

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

  const filteredSongs = useMemo(() => {
    if (!songs) return [];
    if (!librarySearchQuery) return songs;
    const query = librarySearchQuery.toLowerCase();
    return songs.filter(
      (song) =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query)
    );
  }, [songs, librarySearchQuery]);

  const sessionsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'sessions') : null),
    [firestore]
  );
  const { data: sessions, loading: sessionsLoading } =
    useCollection<Session>(sessionsRef);

  const userSession = useMemo(() => {
    if (!user || !sessions) return null;
    return sessions.find((s) => s.id === user.uid);
  }, [user, sessions]);

  // Debounced iTunes Search
  useEffect(() => {
    if (itunesSearchQuery.trim() === '') {
      setItunesSearchResults([]);
      return;
    }

    setIsSearchingItunes(true);
    const debounceTimer = setTimeout(async () => {
      try {
        const searchTerm = encodeURIComponent(itunesSearchQuery);
        const response = await fetch(
          `https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=10`
        );
        if (!response.ok) throw new Error('iTunes API request failed');
        const data = await response.json();
        setItunesSearchResults(data.results || []);
      } catch (error) {
        console.error('iTunes search failed:', error);
        toast({
          variant: 'destructive',
          title: 'Suche fehlgeschlagen',
          description: 'Die Suche nach Songs ist fehlgeschlagen.',
        });
        setItunesSearchResults([]);
      } finally {
        setIsSearchingItunes(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(debounceTimer);
  }, [itunesSearchQuery, toast]);

  const handleSelectSong = (song: any) => {
    setGenerationInfo({
      title: song.trackName,
      artist: song.artistName,
      artworkUrl: song.artworkUrl100?.replace('100x100', '400x400'),
    });
    setLyrics(''); // Clear previous lyrics
    setGenerationDialogOpen(true);
    setIsFetchingLyrics(true);
    setItunesSearchQuery('');
    setItunesSearchResults([]);

    const fetchLyrics = async () => {
      try {
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
            setLyrics('');
          }
        } else {
          setLyrics('');
        }
      } catch (e) {
        console.error('Lyrics fetch error', e);
        setLyrics('');
      } finally {
        setIsFetchingLyrics(false);
      }
    };

    fetchLyrics();
  };

  const handleGenerateSheet = async () => {
    if (!user || !firestore || !generationInfo || !lyrics || !selectedKey) {
      toast({
        variant: 'destructive',
        title: 'Fehlende Informationen',
        description: 'Bitte fülle alle Felder aus.',
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

  const handleManualFormChange = (
    field: keyof typeof manualForm,
    value: string
  ) => {
    setManualForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleManualGenerateSheet = async () => {
    if (
      !user ||
      !firestore ||
      !manualForm.title ||
      !manualForm.artist ||
      !manualForm.lyrics ||
      !manualForm.key
    ) {
      toast({
        variant: 'destructive',
        title: 'Fehlende Informationen',
        description: 'Bitte fülle alle Felder aus.',
      });
      return;
    }

    if (!userProfileRef) return;
    setIsGenerating(true);

    try {
      const sheet = await generateSongSheet({
        artist: manualForm.artist,
        title: manualForm.title,
        lyrics: manualForm.lyrics,
        key: manualForm.key,
      });

      const songsCollectionRef = collection(firestore, 'songs');
      await addDoc(songsCollectionRef, {
        userId: user.uid,
        creatorName: user.displayName || user.email || 'Anonym',
        title: manualForm.title,
        artist: manualForm.artist,
        sheet: { ...sheet, key: manualForm.key },
        createdAt: serverTimestamp(),
        artworkUrl: null, // No artwork for manually added songs
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
        description: `"${manualForm.title}" wurde zur Bibliothek hinzugefügt.`,
      });

      setManualAddDialogOpen(false);
      setManualForm({ title: '', artist: '', lyrics: '', key: 'C' });
    } catch (error: any) {
      console.error('Manual Generation Error: ', error);
      toast({
        variant: 'destructive',
        title: 'Generierung fehlgeschlagen',
        description:
          error.message || 'Das Song-Sheet konnte nicht erstellt werden.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const createSession = async (songId: string) => {
    if (!user || !firestore || !userProfile) return;
    const sessionId = user.uid;
    try {
      const sessionRef = doc(firestore, 'sessions', sessionId);
      await setDoc(sessionRef, {
        id: sessionId,
        hostId: user.uid,
        hostName: userProfile.displayName || user.displayName || 'Unbekannter Host',
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
    (userProfile.role !== 'creator' && userProfile.role !== 'admin')
  ) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-center p-4">
        <LibraryIcon className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold">Zugriff verweigert</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          Du musst ein "Creator" oder "Admin" sein, um die Bibliothek zu
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
    userProfile?.role === 'creator' || userProfile?.role === 'admin';

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
          {canGenerate &&
            (userSession ? (
              <Button
                onClick={() => router.push(`/session/${userSession.id}`)}
              >
                <Share2 className="mr-2 h-4 w-4" /> Session öffnen
              </Button>
            ) : (
              <Dialog
                open={isSessionDialogOpen}
                onOpenChange={setIsSessionDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button disabled={sessionsLoading}>
                    {sessionsLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Share2 className="mr-2 h-4 w-4" />
                    )}
                    Session starten
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Neue Session starten</DialogTitle>
                    <DialogDescription>
                      Wähle einen Song aus, um eine neue Live-Sitzung zu
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
                          <SelectValue placeholder="Wähle einen Song..." />
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
            ))}
          <UserNav />
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {canGenerate && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles />
                Neuen Song hinzufügen
              </CardTitle>
              <CardDescription>
                Suche nach einem Song oder füge ihn manuell hinzu.
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
                  <Label htmlFor="song-search">Suche</Label>
                  <Input
                    id="song-search"
                    placeholder="z.B. Hotel California, Eagles"
                    value={itunesSearchQuery}
                    onChange={(e) => setItunesSearchQuery(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Oder
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setManualAddDialogOpen(true)}
                  disabled={isGenerating}
                >
                  Song manuell erstellen
                </Button>

                {isSearchingItunes && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}

                {!isSearchingItunes && itunesSearchResults.length > 0 && (
                  <div className="border rounded-md max-h-72 overflow-y-auto">
                    <ul className="divide-y">
                      {itunesSearchResults.map((song) => (
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
                {!isSearchingItunes &&
                  itunesSearchQuery &&
                  itunesSearchResults.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center p-4">
                      Keine Ergebnisse gefunden.
                    </p>
                  )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* iTunes Generation Dialog */}
        <Dialog
          open={generationDialogOpen}
          onOpenChange={setGenerationDialogOpen}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Song-Blatt generieren</DialogTitle>
              <DialogDescription>
                Wähle eine Tonart und bestätige den Text, um die
                Akkorde zu generieren.
              </DialogDescription>
            </DialogHeader>
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
                    <SelectGroup>
                      <SelectLabel>Dur</SelectLabel>
                      {MAJOR_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {key}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Moll</SelectLabel>
                      {MINOR_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {key}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="lyrics" className="text-right pt-2">
                  Songtext
                </Label>
                {isFetchingLyrics ? (
                  <div className="col-span-3 min-h-[200px] flex items-center justify-center bg-muted rounded-md">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <Textarea
                    id="lyrics"
                    value={lyrics}
                    onChange={(e) => setLyrics(e.target.value)}
                    className="col-span-3 min-h-[200px]"
                    placeholder="Füge den Songtext hier ein, falls er nicht automatisch gefunden wurde."
                  />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setGenerationDialogOpen(false)}
                disabled={isGenerating}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleGenerateSheet}
                disabled={isGenerating || isFetchingLyrics || !lyrics}
              >
                {isGenerating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Generieren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual Add Dialog */}
        <Dialog
          open={manualAddDialogOpen}
          onOpenChange={setManualAddDialogOpen}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Song manuell erstellen</DialogTitle>
              <DialogDescription>
                Gib die Song-Details ein, um ein Blatt mit KI zu
                generieren.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="manual-title" className="text-right">
                  Titel
                </Label>
                <Input
                  id="manual-title"
                  value={manualForm.title}
                  onChange={(e) =>
                    handleManualFormChange('title', e.target.value)
                  }
                  className="col-span-3"
                  disabled={isGenerating}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="manual-artist" className="text-right">
                  Interpret
                </Label>
                <Input
                  id="manual-artist"
                  value={manualForm.artist}
                  onChange={(e) =>
                    handleManualFormChange('artist', e.target.value)
                  }
                  className="col-span-3"
                  disabled={isGenerating}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="manual-key" className="text-right">
                  Tonart
                </Label>
                <Select
                  value={manualForm.key}
                  onValueChange={(value) => handleManualFormChange('key', value)}
                  disabled={isGenerating}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Tonart auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Dur</SelectLabel>
                      {MAJOR_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {key}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Moll</SelectLabel>
                      {MINOR_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                          {key}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="manual-lyrics" className="text-right pt-2">
                  Songtext
                </Label>
                <Textarea
                  id="manual-lyrics"
                  value={manualForm.lyrics}
                  onChange={(e) =>
                    handleManualFormChange('lyrics', e.target.value)
                  }
                  className="col-span-3 min-h-[200px]"
                  placeholder="Songtext hier einfügen..."
                  disabled={isGenerating}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setManualAddDialogOpen(false)}
                disabled={isGenerating}
              >
                Abbrechen
              </Button>
              <Button
                onClick={handleManualGenerateSheet}
                disabled={isGenerating || !manualForm.lyrics}
              >
                {isGenerating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Generieren
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Alle Songs</h2>
            <div className="w-full max-w-sm">
              <Input
                placeholder="Bibliothek durchsuchen..."
                value={librarySearchQuery}
                onChange={(e) => setLibrarySearchQuery(e.target.value)}
              />
            </div>
          </div>
          {songsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {error && (
            <p className="text-destructive">
              Fehler beim Laden der Songs: {error.message}
            </p>
          )}
          {!songsLoading && filteredSongs.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <Music className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">
                Keine Songs gefunden
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {librarySearchQuery
                  ? 'Deine Suche ergab keine Treffer.'
                  : 'Generiere deinen ersten Song, um zu beginnen.'}
              </p>
            </div>
          )}
          {!songsLoading && filteredSongs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredSongs.map((song) => (
                <SongCard key={song.id} song={song} />
              ))}
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
