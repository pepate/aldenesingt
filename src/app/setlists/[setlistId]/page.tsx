'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Loader2,
  Music,
  Plus,
  Trash2,
  Globe,
  Lock,
  Share2,
  Copy,
  GripVertical,
  Play,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useUser, useFirebase, useMemoFirebase, useDoc, useCollection } from '@/firebase';
import type { Setlist, Song, UserProfile, Session } from '@/lib/types';
import {
  doc,
  updateDoc,
  collection,
  serverTimestamp,
  setDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { UserNav } from '@/components/user-nav';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableSongItemProps {
  songId: string;
  song: Song | undefined;
  isOwner: boolean;
  onRemove: (songId: string) => void;
}

function SortableSongItem({ songId, song, isOwner, onRemove }: SortableSongItemProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: songId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border rounded-lg group"
    >
      {isOwner && (
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
          {...attributes}
          {...listeners}
          aria-label="Ziehen zum Neuanordnen"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      {song?.artworkUrl ? (
        <div className="relative w-10 h-10 rounded overflow-hidden shrink-0">
          <Image src={song.artworkUrl} alt={song.title} fill className="object-cover" sizes="40px" />
        </div>
      ) : (
        <div className="w-10 h-10 flex items-center justify-center bg-muted rounded shrink-0">
          <Music className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {song ? (
          <>
            <p className="font-medium truncate leading-tight">{song.title}</p>
            <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
          </>
        ) : (
          <p className="text-muted-foreground text-sm">Wird geladen...</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {song && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => router.push(`/library/${songId}`)}
            title="Song öffnen"
          >
            <Play className="h-4 w-4" />
          </Button>
        )}
        {isOwner && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onRemove(songId)}
            title="Aus Setliste entfernen"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function SetlistDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const setlistId = Array.isArray(params.setlistId) ? params.setlistId[0] : params.setlistId;

  const [addSongDialogOpen, setAddSongDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [songSearch, setSongSearch] = useState('');
  const [orderedSongIds, setOrderedSongIds] = useState<string[]>([]);

  const setlistRef = useMemoFirebase(
    () => (firestore && setlistId ? doc(firestore, 'setlists', setlistId) : null),
    [firestore, setlistId]
  );
  const { data: setlist, loading: setlistLoading } = useDoc<Setlist>(setlistRef);

  const allSongsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'songs') : null),
    [firestore]
  );
  const { data: allSongs = [], loading: songsLoading } = useCollection<Song>(allSongsRef);

  const isOwner = !!user && setlist?.userId === user.uid;
  const shareUrl = typeof window !== 'undefined' ? `https://aldene.de/s/${setlistId}` : `https://aldene.de/s/${setlistId}`;

  // Keep local order in sync with Firestore
  useEffect(() => {
    if (setlist?.songIds) {
      setOrderedSongIds(setlist.songIds);
    }
  }, [setlist?.songIds]);

  // Map songId -> Song object
  const songMap = useMemo(() => {
    const map = new Map<string, Song>();
    allSongs.forEach((s) => map.set(s.id, s));
    return map;
  }, [allSongs]);

  // Songs not yet in setlist (for add dialog)
  const songsNotInSetlist = useMemo(() => {
    const inSet = new Set(orderedSongIds);
    return allSongs.filter((s) => !inSet.has(s.id));
  }, [allSongs, orderedSongIds]);

  const filteredAvailableSongs = useMemo(() => {
    if (!songSearch.trim()) return songsNotInSetlist;
    const q = songSearch.toLowerCase();
    return songsNotInSetlist.filter(
      (s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    );
  }, [songsNotInSetlist, songSearch]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !setlistRef) return;

    const oldIndex = orderedSongIds.indexOf(active.id as string);
    const newIndex = orderedSongIds.indexOf(over.id as string);
    const newOrder = arrayMove(orderedSongIds, oldIndex, newIndex);
    setOrderedSongIds(newOrder);

    try {
      await updateDoc(setlistRef, { songIds: newOrder, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Reihenfolge konnte nicht gespeichert werden.' });
      setOrderedSongIds(setlist?.songIds ?? []);
    }
  };

  const handleAddSong = async (songId: string) => {
    if (!setlistRef) return;
    try {
      await updateDoc(setlistRef, {
        songIds: arrayUnion(songId),
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Song hinzugefügt' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Song konnte nicht hinzugefügt werden.' });
    }
  };

  const handleRemoveSong = async (songId: string) => {
    if (!setlistRef) return;
    const newOrder = orderedSongIds.filter((id) => id !== songId);
    setOrderedSongIds(newOrder);
    try {
      await updateDoc(setlistRef, {
        songIds: arrayRemove(songId),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Song konnte nicht entfernt werden.' });
      setOrderedSongIds(setlist?.songIds ?? []);
    }
  };

  const handleTogglePublic = async (checked: boolean) => {
    if (!setlistRef) return;
    try {
      await updateDoc(setlistRef, { isPublic: checked, updatedAt: serverTimestamp() });
      toast({
        title: checked ? 'Setliste ist jetzt öffentlich' : 'Setliste ist jetzt privat',
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Sichtbarkeit konnte nicht geändert werden.' });
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast({ title: 'Link kopiert!', description: 'Der öffentliche Link wurde in die Zwischenablage kopiert.' });
    });
  };

  const handleStartSession = async () => {
    if (!user || !firestore || !setlist || orderedSongIds.length === 0) return;
    const firstSongId = orderedSongIds[0];
    const remainingQueue = orderedSongIds.slice(1);
    const sessionId = user.uid;
    try {
      await setDoc(doc(firestore, 'sessions', sessionId), {
        id: sessionId,
        hostId: user.uid,
        hostName: user.displayName || user.email || 'Unbekannt',
        songId: firstSongId,
        queue: remainingQueue,
        scroll: 0,
        transpose: 0,
        createdAt: serverTimestamp(),
        lastActivity: serverTimestamp(),
      });
      router.push(`/session/${sessionId}?host=true`);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Session konnte nicht gestartet werden.' });
    }
  };

  if (setlistLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!setlist) {
    return (
      <div className="flex h-screen flex-col items-center justify-center text-center p-4">
        <Music className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Setliste nicht gefunden</h2>
        <Button className="mt-4" asChild>
          <Link href="/setlists">Zu meinen Setlisten</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 flex items-center justify-between border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/setlists">
              <ArrowLeft />
              <span className="sr-only">Zurück zu Setlisten</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold leading-tight truncate max-w-[200px] sm:max-w-none">
              {setlist.title}
            </h1>
            {setlist.description && (
              <p className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-sm">
                {setlist.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {isOwner && (
            <>
              <div className="flex items-center gap-2">
                {setlist.isPublic ? (
                  <Globe className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
                <Switch
                  id="public-switch"
                  checked={setlist.isPublic}
                  onCheckedChange={handleTogglePublic}
                />
                <Label htmlFor="public-switch" className="text-sm hidden sm:block">
                  {setlist.isPublic ? 'Öffentlich' : 'Privat'}
                </Label>
              </div>

              {setlist.isPublic && (
                <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Teilen
                </Button>
              )}

              <Button
                size="sm"
                onClick={handleStartSession}
                disabled={orderedSongIds.length === 0}
              >
                <Play className="mr-2 h-4 w-4" />
                Session starten
              </Button>
            </>
          )}
          <UserNav />
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-2xl">
        {/* Visibility badge */}
        <div className="flex items-center gap-3 mb-6">
          <Badge variant={setlist.isPublic ? 'default' : 'secondary'} className="flex items-center gap-1">
            {setlist.isPublic ? (
              <><Globe className="h-3 w-3" /> Öffentlich</>
            ) : (
              <><Lock className="h-3 w-3" /> Privat</>
            )}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {orderedSongIds.length} {orderedSongIds.length === 1 ? 'Song' : 'Songs'}
          </span>
        </div>

        {/* Song list */}
        {orderedSongIds.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedSongIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {orderedSongIds.map((songId) => (
                  <SortableSongItem
                    key={songId}
                    songId={songId}
                    song={songMap.get(songId)}
                    isOwner={isOwner}
                    onRemove={handleRemoveSong}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Music className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">Noch keine Songs in dieser Setliste.</p>
          </div>
        )}

        {/* Add song button */}
        {isOwner && (
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() => {
              setSongSearch('');
              setAddSongDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Song hinzufügen
          </Button>
        )}
      </main>

      {/* Add song dialog */}
      <Dialog open={addSongDialogOpen} onOpenChange={setAddSongDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Song hinzufügen</DialogTitle>
            <DialogDescription>
              Wähle einen Song aus der Bibliothek für diese Setliste.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Song oder Interpret suchen..."
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <ScrollArea className="h-64 mt-2">
            {songsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredAvailableSongs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                {songsNotInSetlist.length === 0
                  ? 'Alle Songs sind bereits in dieser Setliste.'
                  : 'Keine Songs gefunden.'}
              </p>
            ) : (
              <div className="space-y-1 pr-2">
                {filteredAvailableSongs.map((song) => (
                  <button
                    key={song.id}
                    className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left transition-colors"
                    onClick={() => {
                      handleAddSong(song.id);
                      setAddSongDialogOpen(false);
                    }}
                  >
                    {song.artworkUrl ? (
                      <div className="relative w-8 h-8 rounded overflow-hidden shrink-0">
                        <Image src={song.artworkUrl} alt={song.title} fill className="object-cover" sizes="32px" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 flex items-center justify-center bg-muted rounded shrink-0">
                        <Music className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSongDialogOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setliste teilen</DialogTitle>
            <DialogDescription>
              Teile diesen öffentlichen Link, damit andere deine Setliste sehen können.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={shareUrl} readOnly className="flex-1" />
            <Button variant="outline" onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-2" />
              Link kopieren
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SetlistDetailPage() {
  return (
    <FirebaseClientProvider>
      <SetlistDetailContent />
    </FirebaseClientProvider>
  );
}
