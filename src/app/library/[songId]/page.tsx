'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Music,
  Pencil,
  Save,
  X,
  Plus,
  Minus,
  ZoomIn,
  ZoomOut,
  Trash2,
  FileText,
  FileImage,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cloneDeep } from 'lodash';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import SongViewer, { getSectionColor } from '@/components/song-viewer';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useDoc, useFirebase, useMemoFirebase, useUser, useCollection } from '@/firebase';
import type { Song, SongSheet, UserProfile, SongVersion } from '@/lib/types';
import {
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { UserNav } from '@/components/user-nav';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { transposeSongSheet } from '@/lib/transpose';
import { VersionHistory } from '@/components/version-history';

const FONT_SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];

const SECTION_LABELS = [
  { value: '', label: 'Keine' },
  { value: 'Strophe', label: 'Strophe' },
  { value: 'Refrain', label: 'Refrain' },
  { value: 'Bridge', label: 'Bridge' },
  { value: 'Intro', label: 'Intro' },
  { value: 'Outro', label: 'Outro' },
  { value: 'Solo', label: 'Solo' },
];

function SongPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const songId = Array.isArray(params.songId)
    ? params.songId[0]
    : params.songId;

  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSheet, setEditedSheet] = useState<SongSheet | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedArtist, setEditedArtist] = useState('');
  const [editedCapo, setEditedCapo] = useState<number>(0);
  const [editedBpm, setEditedBpm] = useState<number>(0);
  const [transpose, setTranspose] = useState(0);
  const [showChords, setShowChords] = useState(true);
  const [fontSizeIndex, setFontSizeIndex] = useState(2); // default to 'text-lg'
  const [displayMode, setDisplayMode] = useState<'text' | 'image'>('text');

  // Transpose preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTranspose, setPreviewTranspose] = useState(0);

  // Version history dialog
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    const savedSizeIndex = localStorage.getItem('song-viewer-font-size-index');
    if (savedSizeIndex) {
      setFontSizeIndex(Number(savedSizeIndex));
    }
  }, []);

  const songRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'songs', songId) : null),
    [firestore, songId]
  );
  const {
    data: song,
    loading: songLoading,
    error: songError,
  } = useDoc<Song>(songRef);

  // Subscribe to versions subcollection (last 5 versions, newest first)
  const versionsRef = useMemoFirebase(
    () =>
      firestore && songId
        ? query(
            collection(firestore, 'songs', songId, 'versions'),
            orderBy('savedAt', 'desc'),
            limit(5)
          )
        : null,
    [firestore, songId]
  );
  const { data: versionsRaw } = useCollection<SongVersion>(versionsRef);
  const versions = versionsRaw ?? [];

  useEffect(() => {
    if (songError) {
      toast({
        variant: 'destructive',
        title: 'Fehler beim Laden des Songs',
        description: 'Auf diesen Song konnte nicht zugegriffen werden.',
      });
      router.push('/library');
    }
  }, [songError, router, toast]);

  useEffect(() => {
    if (initialCheckComplete && !song) {
      toast({
        variant: 'destructive',
        title: 'Song nicht gefunden',
        description: 'Der angeforderte Song existiert nicht.',
      });
      router.push('/library');
    }
  }, [initialCheckComplete, song, router, toast]);

  // Timer to manage the grace period for song loading
  useEffect(() => {
    if (!songLoading) {
      const timer = setTimeout(() => {
        setInitialCheckComplete(true);
      }, 1500); // 1.5s grace period
      return () => clearTimeout(timer);
    }
  }, [songLoading]);

  // When song data loads, initialize the editedSheet state
  useEffect(() => {
    if (song) {
      if (song.sheet) {
        setEditedSheet(cloneDeep(song.sheet));
      }
      setEditedTitle(song.title);
      setEditedArtist(song.artist);
      setEditedCapo(song.capo ?? 0);
      setEditedBpm(song.bpm ?? 0);
    }
  }, [song]);

  const handleSaveEdits = async () => {
    if (!songRef || !editedSheet || !editedTitle || !editedArtist) return;
    try {
      // Save previous state to versions subcollection before overwriting
      if (song && firestore) {
        try {
          await addDoc(collection(firestore, 'songs', songId, 'versions'), {
            sheet: song.sheet,
            title: song.title,
            artist: song.artist,
            savedAt: serverTimestamp(),
            savedBy: user?.uid ?? '',
          });
        } catch (vErr) {
          console.warn('Could not save version snapshot:', vErr);
        }
      }

      await updateDoc(songRef, {
        sheet: editedSheet,
        title: editedTitle,
        artist: editedArtist,
        capo: editedCapo,
        bpm: editedBpm,
      });
      toast({
        title: 'Gespeichert',
        description: 'Änderungen am Song wurden gespeichert.',
      });
      setIsEditing(false);
    } catch (error: any) {
      console.error('Failed to save song:', error);
      toast({
        variant: 'destructive',
        title: 'Speichern fehlgeschlagen',
        description:
          error.message || 'Die Änderungen konnten nicht gespeichert werden.',
      });
    }
  };

  const handleCancelEdit = () => {
    if (song) {
      if (song.sheet) {
        setEditedSheet(cloneDeep(song.sheet));
      }
      setEditedTitle(song.title);
      setEditedArtist(song.artist);
      setEditedCapo(song.capo ?? 0);
      setEditedBpm(song.bpm ?? 0);
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!songRef || !song) return;
    try {
      await deleteDoc(songRef);
      toast({
        title: 'Song gelöscht',
        description: `"${song.title}" wurde entfernt.`,
      });
      router.push('/library');
    } catch (error: any) {
      console.error('Delete Error:', error);
      toast({
        variant: 'destructive',
        title: 'Löschen fehlgeschlagen',
        description: 'Der Song konnte nicht gelöscht werden.',
      });
    }
  };

  const handleTranspose = (amount: number) => {
    setTranspose((prev) => prev + amount);
  };

  const handleFontSizeChange = (amount: number) => {
    const newIndex = Math.max(
      0,
      Math.min(FONT_SIZES.length - 1, fontSizeIndex + amount)
    );
    setFontSizeIndex(newIndex);
    localStorage.setItem('song-viewer-font-size-index', String(newIndex));
  };

  const handleRestoreVersion = (version: SongVersion) => {
    setEditedSheet(cloneDeep(version.sheet));
    setEditedTitle(version.title);
    setEditedArtist(version.artist);
    toast({
      title: 'Version wiederhergestellt',
      description: 'Bitte speichern, um die Version zu übernehmen.',
    });
  };

  // Update section label for all parts with the same base name
  const handleSectionLabelChange = (basePartName: string, label: string) => {
    if (!editedSheet) return;
    const newSheet = cloneDeep(editedSheet);
    newSheet.song.forEach((part) => {
      const currentBase = part.part.replace(/\s+\d+$/, '').trim();
      if (currentBase === basePartName) {
        part.sectionLabel = label || undefined;
      }
    });
    setEditedSheet(newSheet);
  };

  if (songLoading || !initialCheckComplete || !song || !editedSheet) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Song wird geladen...</p>
      </div>
    );
  }

  const canDelete = user?.uid === song.userId || userProfile?.role === 'admin';

  // Compute unique parts for section label selectors (same logic as SongViewer)
  const uniquePartsForLabels = (() => {
    if (!editedSheet?.song) return [];
    const partMap = new Map<string, { baseName: string; sectionLabel?: string }>();
    editedSheet.song.forEach((part) => {
      const baseName = part.part.replace(/\s+\d+$/, '').trim();
      if (!partMap.has(baseName)) {
        partMap.set(baseName, { baseName, sectionLabel: part.sectionLabel });
      }
    });
    return Array.from(partMap.values());
  })();

  // Build transposed preview sheet
  const previewSheet =
    previewTranspose !== 0 && editedSheet
      ? transposeSongSheet(editedSheet, previewTranspose)
      : editedSheet;

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
            {isEditing ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Titel"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="w-36 sm:w-48"
                />
                <Input
                  placeholder="Interpret"
                  value={editedArtist}
                  onChange={(e) => setEditedArtist(e.target.value)}
                  className="w-36 sm:w-48"
                />
                {/* Capo field */}
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-capo" className="text-xs whitespace-nowrap">
                    Capo
                  </Label>
                  <Input
                    id="edit-capo"
                    type="number"
                    min={0}
                    max={12}
                    value={editedCapo}
                    onChange={(e) =>
                      setEditedCapo(
                        Math.min(12, Math.max(0, Number(e.target.value)))
                      )
                    }
                    className="w-16 h-8 text-center"
                  />
                </div>
                {/* BPM field */}
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-bpm" className="text-xs whitespace-nowrap">
                    BPM
                  </Label>
                  <Input
                    id="edit-bpm"
                    type="number"
                    min={0}
                    max={300}
                    value={editedBpm}
                    onChange={(e) =>
                      setEditedBpm(
                        Math.min(300, Math.max(0, Number(e.target.value)))
                      )
                    }
                    className="w-16 h-8 text-center"
                  />
                </div>
              </div>
            ) : (
              <div>
                <span className="font-semibold text-lg leading-tight block truncate">
                  {song?.title || 'Song-Ansicht'}
                </span>
                <span className="text-sm text-muted-foreground block truncate">
                  {song?.artist}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end flex-wrap gap-x-2 sm:gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
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
            {isEditing ? (
              <div className="flex items-center gap-1">
                {/* Version history button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setVersionHistoryOpen(true)}
                  title="Versionshistorie"
                >
                  <History className="h-4 w-4" />
                </Button>
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
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1 rounded-md bg-muted p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleTranspose(-1)}
                    disabled={isEditing}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="font-mono text-sm font-semibold w-8 text-center">
                    {transpose > 0 ? `+${transpose}` : transpose}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleTranspose(1)}
                    disabled={isEditing}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>

                  <Separator orientation="vertical" className="h-5 mx-1" />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleFontSizeChange(-1)}
                    disabled={isEditing}
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
                    disabled={isEditing}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
            {!isEditing && (song?.pageImageUrls?.length ?? 0) > 0 && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDisplayMode(m => m === 'image' ? 'text' : 'image')}
                title={displayMode === 'image' ? 'Text anzeigen' : 'Bild anzeigen'}
              >
                {displayMode === 'image'
                  ? <FileText className="h-4 w-4" />
                  : <FileImage className="h-4 w-4" />
                }
              </Button>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Diese Aktion kann nicht rückgängig gemacht werden. Dadurch
                      wird das Song-Sheet dauerhaft gelöscht.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <UserNav />
        </div>
      </header>
      <main className="flex-1 overflow-hidden flex flex-col">
        {song && editedSheet && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <SongViewer
              key={song.id}
              song={song}
              sessionId={song.id}
              isHost={true}
              sessionRef={null}
              initialScroll={0}
              transpose={transpose}
              isEditing={isEditing}
              sheet={editedSheet}
              onSheetChange={setEditedSheet}
              showChords={showChords}
              fontSize={FONT_SIZES[fontSizeIndex]}
              displayMode={displayMode}
            />

            {/* Section label selectors — shown in edit mode below the editor */}
            {isEditing && uniquePartsForLabels.length > 0 && (
              <div className="border-t p-4 bg-muted/30 shrink-0 overflow-y-auto max-h-48">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Abschnittstypen
                </p>
                <div className="flex flex-wrap gap-3">
                  {uniquePartsForLabels.map(({ baseName, sectionLabel }) => {
                    const color = getSectionColor(sectionLabel);
                    return (
                      <div key={baseName} className="flex items-center gap-2">
                        {/* Colour dot */}
                        <span
                          className="inline-block h-3 w-3 rounded-full border shrink-0"
                          style={{
                            backgroundColor:
                              color !== 'transparent' ? color : 'hsl(var(--muted-foreground))',
                            opacity: color !== 'transparent' ? 1 : 0.3,
                          }}
                        />
                        <span className="text-sm font-medium min-w-[4rem]">
                          {baseName}
                        </span>
                        <Select
                          value={sectionLabel ?? ''}
                          onValueChange={(val) =>
                            handleSectionLabelChange(baseName, val)
                          }
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue placeholder="Keine" />
                          </SelectTrigger>
                          <SelectContent>
                            {SECTION_LABELS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="text-xs"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Transpose preview — shown in edit mode */}
            {isEditing && (
              <div className="border-t shrink-0">
                <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full flex items-center justify-between rounded-none h-9 px-4 text-sm font-medium"
                    >
                      <span>Vorschau Transponierung</span>
                      {previewOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t bg-muted/20">
                      <div className="flex items-center gap-4 px-4 py-2 border-b">
                        <Label className="text-xs whitespace-nowrap">
                          Halbtöne:{' '}
                          <span className="font-mono font-bold">
                            {previewTranspose > 0
                              ? `+${previewTranspose}`
                              : previewTranspose}
                          </span>
                        </Label>
                        <Slider
                          min={-6}
                          max={6}
                          step={1}
                          value={[previewTranspose]}
                          onValueChange={([val]) => setPreviewTranspose(val)}
                          className="flex-1 max-w-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setPreviewTranspose(0)}
                          disabled={previewTranspose === 0}
                        >
                          Zurücksetzen
                        </Button>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        <SongViewer
                          key={`preview-${song.id}`}
                          song={song}
                          sessionId={`preview-${song.id}`}
                          isHost={false}
                          sessionRef={null}
                          initialScroll={0}
                          transpose={0}
                          isEditing={false}
                          sheet={previewSheet ?? editedSheet}
                          onSheetChange={() => {}}
                          showChords={true}
                          fontSize="text-sm"
                          displayMode="text"
                          showCapoBpm={false}
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Version History Dialog */}
      <VersionHistory
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        versions={versions}
        onRestore={handleRestoreVersion}
      />
    </div>
  );
}

export default function SongPage() {
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
        <SongPageContent />
      </FirebaseClientProvider>
    </Suspense>
  );
}
