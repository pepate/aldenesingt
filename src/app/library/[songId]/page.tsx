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
} from 'lucide-react';
import { cloneDeep } from 'lodash';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import SongViewer from '@/components/song-viewer';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useDoc, useFirebase, useMemoFirebase, useUser } from '@/firebase';
import type { Song, SongSheet, UserProfile } from '@/lib/types';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
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


const FONT_SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];

function SongPageContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();

  const songId = Array.isArray(params.songId)
    ? params.songId[0]
    : params.songId;

  const [isEditing, setIsEditing] = useState(false);
  const [editedSheet, setEditedSheet] = useState<SongSheet | null>(null);
  const [transpose, setTranspose] = useState(0);
  const [showChords, setShowChords] = useState(true);
  const [fontSizeIndex, setFontSizeIndex] = useState(2); // default to 'text-lg'

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
    if (!songLoading && !song) {
      toast({
        variant: 'destructive',
        title: 'Song nicht gefunden',
        description: 'Der angeforderte Song existiert nicht.',
      });
      router.push('/library');
    }
  }, [songLoading, song, router, toast]);

  // When song data loads, initialize the editedSheet state
  useEffect(() => {
    if (song?.sheet) {
      setEditedSheet(cloneDeep(song.sheet));
    }
  }, [song]);

  const handleSaveEdits = async () => {
    if (!songRef || !editedSheet) return;
    try {
      await updateDoc(songRef, { sheet: editedSheet });
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
    if (song?.sheet) {
      setEditedSheet(cloneDeep(song.sheet));
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

  if (songLoading || !song || !editedSheet) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Song wird geladen...</p>
      </div>
    );
  }

  const canDelete = user?.uid === song.userId || userProfile?.role === 'admin';

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
            <span className="font-semibold text-lg">
              {song?.title || 'Song-Ansicht'}
            </span>
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
             {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" className="h-8 w-8">
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
      <main className="flex-1 overflow-hidden">
        {song && editedSheet && (
          <SongViewer
            key={song.id}
            song={song}
            sessionId={song.id} // Not a real session, but needed for key
            isHost={true} // To enable host controls
            sessionRef={null} // No session to sync with
            initialScroll={0}
            transpose={transpose}
            isEditing={isEditing}
            sheet={editedSheet}
            onSheetChange={setEditedSheet}
            showChords={showChords}
            fontSize={FONT_SIZES[fontSizeIndex]}
          />
        )}
      </main>
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
