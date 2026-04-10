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
  Star,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Tag as TagIcon,
  ListMusic,
  PlusCircle,
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
  arrayUnion,
  arrayRemove,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import type { Song, UserProfile, Session, SongTag, Setlist } from '@/lib/types';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { TagManager, TagPills } from '@/components/tag-manager';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

const MAJOR_KEYS = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];
const MINOR_KEYS = [
  'Am', 'A#m', 'Bm', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m',
];

function isMissingChords(song: Song): boolean {
  if (!song.sheet?.song?.length) return true;
  return song.sheet.song.every((part) =>
    part.lines.every((line) => !line.chords || line.chords.trim() === '')
  );
}

interface SongCardProps {
  song: Song;
  isFavourite: boolean;
  onToggleFavourite: (songId: string, isFav: boolean) => void;
  allTags: SongTag[];
  firestore: any;
  userId: string;
  missingChords: boolean;
  userSetlists: Setlist[];
  onAddToSetlist: (songId: string, setlistId: string) => void;
}

function SongCard({
  song,
  isFavourite,
  onToggleFavourite,
  allTags,
  firestore,
  userId,
  missingChords,
  userSetlists,
  onAddToSetlist,
}: SongCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const hasArtwork = !!song.artworkUrl;
  const songTagIds = song.tags ?? [];
  const assignedTags = allTags.filter((t) => songTagIds.includes(t.id));
  const [setlistPopoverOpen, setSetlistPopoverOpen] = useState(false);

  return (
    <Card
      onClick={() => router.push(`/library/${song.id}`)}
      className="flex flex-col group relative overflow-hidden cursor-pointer card-hover border-border/60"
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
      <CardHeader className="relative flex-grow pb-2">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate leading-tight text-lg">
              {song.title || 'Unbekannter Song'}
            </CardTitle>
            <CardDescription className="mt-1">
              {song.artist || ' '}
            </CardDescription>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {userSetlists.length > 0 && (
              <Popover open={setlistPopoverOpen} onOpenChange={setSetlistPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    className="p-1 rounded hover:bg-accent transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="Zur Setliste hinzufügen"
                  >
                    <PlusCircle className="h-4 w-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-56 p-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                    Zur Setliste hinzufügen
                  </p>
                  <ScrollArea className="max-h-40">
                    <div className="space-y-0.5">
                      {userSetlists.map((sl) => (
                        <button
                          key={sl.id}
                          className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors flex items-center gap-2"
                          onClick={() => {
                            onAddToSetlist(song.id, sl.id);
                            setSetlistPopoverOpen(false);
                          }}
                        >
                          <ListMusic className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{sl.title}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            )}
            <button
              className="p-1 rounded hover:bg-accent transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavourite(song.id, isFavourite);
              }}
              title={isFavourite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
            >
              {isFavourite ? (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ) : (
                <Star className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-shrink-0 text-sm pt-0 relative space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-4 w-4" />
          <span className="truncate">{song.creatorName || 'Unbekannt'}</span>
          {missingChords && (
            <span title="Keine Akkorde">
              <AlertTriangle className="h-4 w-4 text-amber-500 ml-1" />
            </span>
          )}
        </div>
        {assignedTags.length > 0 && <TagPills tags={assignedTags} />}
      </CardContent>
      <CardFooter className="pt-0 relative">
        <TagManager
          firestore={firestore}
          userId={userId}
          songId={song.id}
          songTagIds={songTagIds}
          allTags={allTags}
        />
      </CardFooter>
    </Card>
  );
}

type SortOption = 'title-asc' | 'artist-asc' | 'newest' | 'most-played';

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

  // Duplicate warning dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingAddFn, setPendingAddFn] = useState<(() => Promise<void>) | null>(null);

  // --- New filter/sort state ---
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('title-asc');
  const [groupByArtist, setGroupByArtist] = useState(false);
  const [showMissingChordsOnly, setShowMissingChordsOnly] = useState(false);
  // Collapsible open state per artist
  const [openArtists, setOpenArtists] = useState<Record<string, boolean>>({});

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

  // Tags collection
  const tagsRef = useMemoFirebase(
    () =>
      firestore && user
        ? query(collection(firestore, 'tags'), where('userId', '==', user.uid))
        : null,
    [firestore, user]
  );
  const { data: allTagsRaw } = useCollection<SongTag>(tagsRef);
  const allTags = allTagsRaw ?? [];

  // User setlists
  const userSetlistsRef = useMemoFirebase(
    () =>
      firestore && user
        ? query(
            collection(firestore, 'setlists'),
            where('userId', '==', user.uid),
            orderBy('updatedAt', 'desc')
          )
        : null,
    [firestore, user]
  );
  const { data: userSetlistsRaw } = useCollection<Setlist>(userSetlistsRef);
  const userSetlists = userSetlistsRaw ?? [];

  const handleAddToSetlist = async (songId: string, setlistId: string) => {
    if (!firestore) return;
    try {
      await updateDoc(doc(firestore, 'setlists', setlistId), {
        songIds: arrayUnion(songId),
        updatedAt: serverTimestamp(),
      });
      const sl = userSetlists.find((s) => s.id === setlistId);
      toast({
        title: 'Song hinzugefügt',
        description: sl ? `Zur Setliste "${sl.title}" hinzugefügt.` : undefined,
      });
    } catch (err) {
      console.error('Add to setlist failed', err);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Song konnte nicht zur Setliste hinzugefügt werden.',
      });
    }
  };

  // Favourites toggle
  const handleToggleFavourite = async (songId: string, isFav: boolean) => {
    if (!user || !firestore) return;
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        favourites: isFav ? arrayRemove(songId) : arrayUnion(songId),
      });
    } catch (err) {
      console.error('Favourites update failed', err);
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Favorit konnte nicht gespeichert werden.',
      });
    }
  };

  const favouriteIds = useMemo(
    () => new Set(userProfile?.favourites ?? []),
    [userProfile]
  );

  const filteredSongs = useMemo(() => {
    if (!songs) return [];
    let result = [...songs];

    // Text search
    if (librarySearchQuery) {
      const q = librarySearchQuery.toLowerCase();
      result = result.filter(
        (song) =>
          song.title.toLowerCase().includes(q) ||
          song.artist.toLowerCase().includes(q)
      );
    }

    // Favourites filter
    if (showFavouritesOnly) {
      result = result.filter((song) => favouriteIds.has(song.id));
    }

    // Tag filter
    if (selectedTagIds.length > 0) {
      result = result.filter((song) =>
        selectedTagIds.every((tid) => (song.tags ?? []).includes(tid))
      );
    }

    // Missing chords filter
    if (showMissingChordsOnly) {
      result = result.filter((song) => isMissingChords(song));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'title-asc':
          return a.title.localeCompare(b.title);
        case 'artist-asc':
          return a.artist.localeCompare(b.artist);
        case 'newest':
          return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
        case 'most-played':
          return (b.playCount ?? 0) - (a.playCount ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [songs, librarySearchQuery, showFavouritesOnly, favouriteIds, selectedTagIds, showMissingChordsOnly, sortOption]);

  // Group by artist
  const artistGroups = useMemo(() => {
    if (!groupByArtist) return null;
    const map = new Map<string, Song[]>();
    for (const song of filteredSongs) {
      const key = song.artist || 'Unbekannter Künstler';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(song);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [groupByArtist, filteredSongs]);

  const toggleArtist = (artist: string) => {
    setOpenArtists((prev) => ({ ...prev, [artist]: !prev[artist] }));
  };

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
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [itunesSearchQuery, toast]);

  const handleSelectSong = (song: any) => {
    setGenerationInfo({
      title: song.trackName,
      artist: song.artistName,
      artworkUrl: song.artworkUrl100?.replace('100x100', '400x400'),
    });
    setLyrics('');
    setGenerationDialogOpen(true);
    setIsFetchingLyrics(true);
    setItunesSearchQuery('');
    setItunesSearchResults([]);

    const fetchLyrics = async () => {
      try {
        const lyricsResponse = await fetch(
          `/api/lyrics/${encodeURIComponent(song.artistName)}/${encodeURIComponent(song.trackName)}`
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

      const doSave = async () => {
        const songsCollectionRef = collection(firestore, 'songs');
        await addDoc(songsCollectionRef, {
          userId: user.uid,
          creatorName: user.displayName || user.email || 'Anonym',
          title: generationInfo.title,
          artist: generationInfo.artist,
          sheet: { ...sheet, key: selectedKey },
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
        setIsGenerating(false);
        setLyrics('');
        setGenerationInfo(null);
      };

      // Check for duplicate
      const titleLower = generationInfo.title.toLowerCase();
      const artistLower = generationInfo.artist.toLowerCase();
      const isDuplicate = (songs ?? []).some(
        (s) =>
          s.title.toLowerCase() === titleLower &&
          s.artist.toLowerCase() === artistLower
      );

      if (isDuplicate) {
        setPendingAddFn(() => doSave);
        setDuplicateDialogOpen(true);
        setIsGenerating(false);
        return;
      }

      await doSave();
    } catch (error: any) {
      console.error('Generation Error: ', error);
      toast({
        variant: 'destructive',
        title: 'Generierung fehlgeschlagen',
        description:
          error.message || 'Das Song-Sheet konnte nicht erstellt werden.',
      });
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

      const doManualSave = async () => {
        const songsCollectionRef = collection(firestore, 'songs');
        await addDoc(songsCollectionRef, {
          userId: user.uid,
          creatorName: user.displayName || user.email || 'Anonym',
          title: manualForm.title,
          artist: manualForm.artist,
          sheet: { ...sheet, key: manualForm.key },
          createdAt: serverTimestamp(),
          artworkUrl: null,
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
        setIsGenerating(false);
      };

      // Check for duplicate
      const titleLower = manualForm.title.toLowerCase();
      const artistLower = manualForm.artist.toLowerCase();
      const isDuplicate = (songs ?? []).some(
        (s) =>
          s.title.toLowerCase() === titleLower &&
          s.artist.toLowerCase() === artistLower
      );

      if (isDuplicate) {
        setPendingAddFn(() => doManualSave);
        setDuplicateDialogOpen(true);
        setIsGenerating(false);
        return;
      }

      await doManualSave();
    } catch (error: any) {
      console.error('Manual Generation Error: ', error);
      toast({
        variant: 'destructive',
        title: 'Generierung fehlgeschlagen',
        description:
          error.message || 'Das Song-Sheet konnte nicht erstellt werden.',
      });
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

  const renderSongGrid = (songList: Song[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {songList.map((song) => (
        <SongCard
          key={song.id}
          song={song}
          isFavourite={favouriteIds.has(song.id)}
          onToggleFavourite={handleToggleFavourite}
          allTags={allTags}
          firestore={firestore}
          userId={user.uid}
          missingChords={isMissingChords(song)}
          userSetlists={userSetlists}
          onAddToSetlist={handleAddToSetlist}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 sm:p-6 flex justify-between items-center border-b sticky top-0 bg-card/60 backdrop-blur-sm z-10">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => router.push('/')}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-sm">
            <LibraryIcon className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Songs</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/setlists')}>
            <ListMusic className="mr-2 h-4 w-4" />
            Setlisten
          </Button>
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
                  <Button
                    disabled={sessionsLoading}
                    className="bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90"
                  >
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
          <Card className="mb-8 border-border/60 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary to-violet-500" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="text-primary" />
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

        {/* Library Section */}
        <div>
          {/* Toolbar */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-2xl font-bold gradient-text">Alle Songs</h2>
              <div className="w-full max-w-sm">
                <Input
                  placeholder="Bibliothek durchsuchen..."
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Filters & Sort row */}
            <div className="flex flex-wrap items-center gap-4 py-3 px-4 bg-card/80 rounded-xl border border-border/60 shadow-sm">
              {/* Sort */}
              <div className="flex items-center gap-2 min-w-[200px]">
                <Label htmlFor="sort-select" className="text-sm whitespace-nowrap">
                  Sortieren:
                </Label>
                <Select
                  value={sortOption}
                  onValueChange={(v) => setSortOption(v as SortOption)}
                >
                  <SelectTrigger id="sort-select" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="title-asc">A–Z (Titel)</SelectItem>
                    <SelectItem value="artist-asc">A–Z (Künstler)</SelectItem>
                    <SelectItem value="newest">Neueste zuerst</SelectItem>
                    <SelectItem value="most-played">Meist gespielt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="h-5 w-px bg-border hidden sm:block" />

              {/* Favourites toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="fav-filter"
                  checked={showFavouritesOnly}
                  onCheckedChange={setShowFavouritesOnly}
                />
                <Label htmlFor="fav-filter" className="text-sm flex items-center gap-1 cursor-pointer">
                  <Star className="h-3.5 w-3.5 text-yellow-400" />
                  Nur Favoriten
                </Label>
              </div>

              <div className="h-5 w-px bg-border hidden sm:block" />

              {/* Missing chords toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="chords-filter"
                  checked={showMissingChordsOnly}
                  onCheckedChange={setShowMissingChordsOnly}
                />
                <Label htmlFor="chords-filter" className="text-sm flex items-center gap-1 cursor-pointer">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  Nur Songs ohne Akkorde
                </Label>
              </div>

              <div className="h-5 w-px bg-border hidden sm:block" />

              {/* Group by artist toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="group-artist"
                  checked={groupByArtist}
                  onCheckedChange={setGroupByArtist}
                />
                <Label htmlFor="group-artist" className="text-sm cursor-pointer whitespace-nowrap">
                  Nach Künstler gruppieren
                </Label>
              </div>

              {/* Tag filter */}
              {allTags.length > 0 && (
                <>
                  <div className="h-5 w-px bg-border hidden sm:block" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <TagIcon className="h-3.5 w-3.5" />
                      Labels:
                    </span>
                    {allTags.map((tag) => {
                      const isActive = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() =>
                            setSelectedTagIds((prev) =>
                              isActive
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id]
                            )
                          }
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white transition-opacity"
                          style={{
                            backgroundColor: tag.color,
                            opacity: isActive ? 1 : 0.45,
                            outline: isActive ? `2px solid ${tag.color}` : 'none',
                            outlineOffset: '2px',
                          }}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Song count */}
          {!songsLoading && (
            <p className="text-sm text-muted-foreground mb-4">
              {filteredSongs.length}{' '}
              {filteredSongs.length === 1 ? 'Song' : 'Songs'}
              {(showFavouritesOnly || showMissingChordsOnly || selectedTagIds.length > 0 || librarySearchQuery)
                ? ' gefunden'
                : ' gesamt'}
            </p>
          )}

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
                {librarySearchQuery || showFavouritesOnly || showMissingChordsOnly || selectedTagIds.length > 0
                  ? 'Deine Filter ergaben keine Treffer.'
                  : 'Generiere deinen ersten Song, um zu beginnen.'}
              </p>
            </div>
          )}

          {/* Grouped by artist */}
          {!songsLoading && filteredSongs.length > 0 && groupByArtist && artistGroups && (
            <div className="space-y-4">
              {artistGroups.map(([artist, artistSongs]) => {
                const isOpen = openArtists[artist] !== false; // default open
                return (
                  <Collapsible
                    key={artist}
                    open={isOpen}
                    onOpenChange={() => toggleArtist(artist)}
                  >
                    <CollapsibleTrigger className="flex items-center gap-3 w-full text-left py-2 px-3 rounded-lg hover:bg-accent transition-colors sticky top-[73px] bg-background/95 backdrop-blur-sm z-[5]">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className="font-semibold text-lg">{artist}</span>
                      <Badge variant="secondary" className="ml-1">
                        {artistSongs.length}
                      </Badge>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      {renderSongGrid(artistSongs)}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {/* Flat list */}
          {!songsLoading && filteredSongs.length > 0 && !groupByArtist && (
            renderSongGrid(filteredSongs)
          )}
        </div>
      </main>

      {/* Duplicate warning dialog */}
      <AlertDialog
        open={duplicateDialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setDuplicateDialogOpen(false);
            setPendingAddFn(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Song bereits vorhanden</AlertDialogTitle>
            <AlertDialogDescription>
              Ein Song mit diesem Titel und Künstler existiert bereits.
              Trotzdem speichern?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDuplicateDialogOpen(false);
                setPendingAddFn(null);
              }}
            >
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setDuplicateDialogOpen(false);
                if (pendingAddFn) {
                  setIsGenerating(true);
                  try {
                    await pendingAddFn();
                  } catch (err: any) {
                    console.error('Duplicate save error:', err);
                    toast({
                      variant: 'destructive',
                      title: 'Speichern fehlgeschlagen',
                      description: err.message || 'Der Song konnte nicht gespeichert werden.',
                    });
                  } finally {
                    setIsGenerating(false);
                    setPendingAddFn(null);
                  }
                }
              }}
            >
              Trotzdem speichern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
