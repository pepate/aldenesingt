'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
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
  uploadFile,
  deleteFile,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  setDoc,
} from 'firebase/firestore';
import type { Song } from '@/lib/types';
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
import { UserNav } from '@/components/user-nav';
import { extractSongFromPdf } from '@/ai/flows/extract-song-flow';

function LibraryPage() {
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const songsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'songs') : null),
    [firestore]
  );

  const {
    data: songs,
    loading: songsLoading,
    error,
  } = useCollection<Song>(songsRef);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        toast({
          variant: 'destructive',
          title: 'Ungültiger Dateityp',
          description: 'Bitte laden Sie nur PDF-Dateien hoch.',
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleProcessAndUpload = async () => {
    if (!file || !user || !firestore || !songsRef) {
      toast({
        variant: 'destructive',
        title: 'Fehlende Informationen',
        description: 'Bitte wählen Sie eine Datei aus.',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Convert file to data URI
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const pdfDataUri = reader.result as string;

        // 2. Call Genkit flow to extract content
        const extractedData = await extractSongFromPdf({ pdfDataUri });

        if (!extractedData || !extractedData.content) {
            throw new Error("Die KI konnte keinen Inhalt aus der PDF extrahieren.");
        }

        // 3. Upload original PDF to storage for reference
        const fileId = Date.now().toString(); // simple unique enough id
        const storagePath = `documents/${user.uid}/${fileId}-${file.name}`;
        await uploadFile(storagePath, file);

        // 4. Save extracted content to Firestore
        await addDoc(songsRef, {
          userId: user.uid,
          title: extractedData.title,
          content: extractedData.content,
          storagePath: storagePath,
          createdAt: serverTimestamp(),
        });

        toast({
          title: 'Song extrahiert & gespeichert',
          description: `"${extractedData.title}" wurde zur Bibliothek hinzugefügt.`,
        });
        setFile(null);
      };
      reader.onerror = (error) => {
        console.error("FileReader Error: ", error);
        throw new Error("Fehler beim Lesen der Datei.");
      }

    } catch (error: any) {
      console.error('Processing Error: ', error);
      toast({
        variant: 'destructive',
        title: 'Verarbeitung fehlgeschlagen',
        description:
          error.message ||
          'Der Song konnte nicht aus der Datei extrahiert werden.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (songToDelete: Song) => {
    if (!firestore || !user || user.uid !== songToDelete.userId) return;
    try {
      // First, delete the file from Storage
      if (songToDelete.storagePath) {
        await deleteFile(songToDelete.storagePath);
      }

      // Then, delete the document from Firestore
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
        createdAt: serverTimestamp(),
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

  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-center p-4">
        <LibraryIcon className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold">Bitte anmelden</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          Sie müssen angemeldet sein, um die Bibliothek zu sehen und Songs
          hochzuladen.
        </p>
        <Button onClick={() => router.push('/auth')}>
          <LogIn className="mr-2" />
          Zur Anmeldung
        </Button>
      </div>
    );
  }

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
        <UserNav />
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle />
              Neuen Song hinzufügen
            </CardTitle>
            <CardDescription>
              Laden Sie eine PDF-Datei hoch. Unsere KI extrahiert automatisch
              Text und Akkorde.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="file:text-primary file:font-semibold"
            />
            <Button
              onClick={handleProcessAndUpload}
              disabled={isProcessing || !file}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird verarbeitet...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2" />
                  Extrahieren & Hochladen
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-2xl font-bold mb-4">Alle Songs</h2>
          {songsLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="h-40 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </Card>
              ))}
            </div>
          )}
          {error && (
            <p className="text-destructive">
              Fehler beim Laden der Songs: {error.message}
            </p>
          )}
          {!songsLoading && songs && songs.length === 0 && (
            <p className="text-muted-foreground mt-4">
              Es wurden noch keine Songs hinzugefügt.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {songs?.map((songItem) => (
              <Card key={songItem.id} className="flex flex-col">
                <CardHeader className="flex-row items-start gap-4 space-y-0">
                    <div className='flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10'>
                        <Music className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="truncate text-lg">{songItem.title}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow"></CardContent>
                <CardFooter className="flex justify-between items-center gap-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => createSession(songItem.id)}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Session starten
                  </Button>
                  {user && user.uid === songItem.userId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Diese Aktion kann nicht rückgängig gemacht werden.
                            Dadurch wird der Song dauerhaft gelöscht.
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
                </CardFooter>
              </Card>
            ))}
          </div>
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
