'use client';
import { useState } from 'react';
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
import type { Song, UserProfile } from '@/lib/types';
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
import { generateSongSheet } from '@/ai/flows/generate-song-sheet-flow';
import { Label } from '@/components/ui/label';

function LibraryPage() {
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
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

  const handleGenerateSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !songTitle ||
      !artist ||
      !user ||
      !firestore ||
      !userProfileRef ||
      !userProfile
    ) {
      toast({
        variant: 'destructive',
        title: 'Fehlende Informationen',
        description: 'Bitte geben Sie Songtitel und Künstler an.',
      });
      return;
    }

    if (userProfile.role !== 'creator' && userProfile.role !== 'admin') {
      toast({
        variant: 'destructive',
        title: 'Keine Berechtigung',
        description:
          'Sie haben nicht die nötige Berechtigung, um Songs zu generieren.',
      });
      return;
    }

    // Daily limit check for creators
    if (userProfile.role === 'creator') {
      const today = new Date().toISOString().split('T')[0];
      const songsToday =
        userProfile.lastGenerationDate === today
          ? userProfile.songsGeneratedToday
          : 0;

      if (songsToday >= 5) {
        toast({
          variant: 'destructive',
          title: 'Tageslimit erreicht',
          description:
            'Sie haben Ihr Limit von 5 generierten Songs für heute erreicht.',
        });
        return;
      }
    }

    setIsGenerating(true);
    try {
      const { songtitle, artist: songArtist, sheet } = await generateSongSheet({
        title: songTitle,
        artist,
      });

      if (!sheet || !sheet.song) {
        throw new Error('Die KI konnte kein gültiges Song-Sheet erstellen.');
      }

      const songsCollectionRef = collection(firestore, 'songs');
      await addDoc(songsCollectionRef, {
        userId: user.uid,
        creatorName: user.displayName || user.email || 'Anonym',
        title: songtitle,
        artist: songArtist,
        sheet: sheet,
        createdAt: serverTimestamp(),
      });

      // Update generation count for creators
      if (userProfile.role === 'creator') {
        const today = new Date().toISOString().split('T')[0];
        const newCount =
          userProfile.lastGenerationDate === today
            ? userProfile.songsGeneratedToday + 1
            : 1;
        await updateDoc(userProfileRef, {
          songsGeneratedToday: newCount,
          lastGenerationDate: today,
        });
      }

      toast({
        title: 'Song-Sheet generiert & gespeichert',
        description: `"${songtitle}" von ${songArtist} wurde zur Bibliothek hinzugefügt.`,
      });
      setSongTitle('');
      setArtist('');
    } catch (error: any) {
      console.error('Processing Error: ', error);
      toast({
        variant: 'destructive',
        title: 'Generierung fehlgeschlagen',
        description:
          error.message || 'Das Song-Sheet konnte nicht generiert werden.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (songToDelete: Song) => {
    if (
      !firestore ||
      !user ||
      (user.uid !== songToDelete.userId && userProfile?.role !== 'admin')
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
    (userProfile.role !== 'creator' && userProfile.role !== 'admin')
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
    userProfile?.role === 'creator' || userProfile?.role === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 sm:p-6 flex justify-between items-center border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => router.push('/')}
        >
          <LibraryIcon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Bibliothek</h1>
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
                            {song.title} - {song.artist}
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
                <PlusCircle />
                Neuen Song generieren
              </CardTitle>
              <CardDescription>
                Geben Sie einen Songtitel und Künstler an. Unsere KI generiert
                automatisch ein Song-Sheet mit Text und Akkorden.
                {userProfile?.role === 'creator' &&
                  ` (${
                    5 -
                    (userProfile.lastGenerationDate ===
                    new Date().toISOString().split('T')[0]
                      ? userProfile.songsGeneratedToday
                      : 0)
                  }/5 heute übrig)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateSong} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="song-title">Songtitel</Label>
                    <Input
                      id="song-title"
                      placeholder="z.B. Über den Wolken"
                      value={songTitle}
                      onChange={(e) => setSongTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="artist">Künstler</Label>
                    <Input
                      id="artist"
                      placeholder="z.B. Reinhard Mey"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isGenerating || !songTitle || !artist}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Wird generiert...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2" />
                      Song-Sheet generieren
                    </>
                  )}
                </Button>
              </form>
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
                    <TableHead className="w-[40%]">Song</TableHead>
                    <TableHead className="w-[25%]">Creator</TableHead>
                    <TableHead className="w-[20%]">Erstellt am</TableHead>
                    <TableHead className="text-right w-[15%]">
                      Aktionen
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(5)].map((_, i) => (
                    <TableRow key={i}>
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
                    <TableHead className="w-[40%]">Song</TableHead>
                    <TableHead className="w-[25%]">Creator</TableHead>
                    <TableHead className="w-[20%]">Erstellt am</TableHead>
                    <TableHead className="text-right w-[15%]">
                      Aktionen
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {songs?.map((songItem) => (
                    <TableRow key={songItem.id}>
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
                        {(user?.uid === songItem.userId ||
                          userProfile?.role === 'admin') && (
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
