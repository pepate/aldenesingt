'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  BookOpen,
  Trash2,
  PlusCircle,
  LogIn,
  Loader2,
  Share2,
  Library as LibraryIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
import type { PdfDocument } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
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

function LibraryPage() {
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const documentsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'pdf_documents') : null),
    [firestore]
  );

  const {
    data: documents,
    loading: docsLoading,
    error,
  } = useCollection<PdfDocument>(documentsRef);

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
      if (!title) {
        setTitle(selectedFile.name.replace('.pdf', ''));
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title || !user || !firestore || !documentsRef) {
      toast({
        variant: 'destructive',
        title: 'Fehlende Informationen',
        description:
          'Bitte wählen Sie eine Datei aus und geben Sie einen Titel ein.',
      });
      return;
    }

    setIsUploading(true);
    try {
      const docId = uuidv4();
      const storagePath = `documents/${user.uid}/${docId}.pdf`;
      const downloadURL = await uploadFile(storagePath, file);

      await addDoc(documentsRef, {
        id: docId,
        title,
        url: downloadURL,
        userId: user.uid,
        createdAt: serverTimestamp(),
        storagePath: storagePath,
      });

      toast({
        title: 'Upload erfolgreich',
        description: `"${title}" wurde zur Bibliothek hinzugefügt.`,
      });
      setFile(null);
      setTitle('');
    } catch (error: any) {
      console.error('Upload Error: ', error);
      toast({
        variant: 'destructive',
        title: 'Upload fehlgeschlagen',
        description:
          error.message || 'Die Datei konnte nicht hochgeladen werden.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docToDelete: PdfDocument) => {
    if (!firestore || !user || user.uid !== docToDelete.userId) return;
    try {
      // First, delete the file from Storage
      if (docToDelete.storagePath) {
        await deleteFile(docToDelete.storagePath);
      }

      // Then, delete the document from Firestore
      const docRef = doc(firestore, 'pdf_documents', docToDelete.id);
      await deleteDoc(docRef);

      toast({
        title: 'Dokument gelöscht',
        description: `"${docToDelete.title}" wurde entfernt.`,
      });
    } catch (error: any) {
      console.error('Delete Error:', error);
      toast({
        variant: 'destructive',
        title: 'Löschen fehlgeschlagen',
        description: 'Das Dokument konnte nicht gelöscht werden.',
      });
    }
  };

  const createSession = async (songId: string) => {
    if (!user || !firestore) return;

    // Generate a 3-digit alphanumeric session ID
    const sessionId = Math.random().toString(36).substring(2, 5).toUpperCase();

    try {
      const sessionCollection = collection(firestore, 'sessions');
      // Use setDoc with the generated ID
      await setDoc(doc(sessionCollection, sessionId), {
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
          Sie müssen angemeldet sein, um die Bibliothek zu sehen und Dokumente hochzuladen.
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
              Neues Dokument hochladen
            </CardTitle>
            <CardDescription>
              Laden Sie eine neue PDF-Datei in die gemeinsame Bibliothek hoch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="file:text-primary file:font-semibold"
            />
            <Input
              placeholder="Titel des Dokuments"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!file}
            />
            <Button
              onClick={handleUpload}
              disabled={isUploading || !file || !title}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <Upload className="mr-2" />
                  Hochladen
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-2xl font-bold mb-4">Alle Dokumente</h2>
          {docsLoading && (
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
              Fehler beim Laden der Dokumente: {error.message}
            </p>
          )}
          {!docsLoading && documents && documents.length === 0 && (
            <p className="text-muted-foreground mt-4">
              Es wurden noch keine Dokumente hochgeladen.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {documents?.map((docItem) => (
              <Card key={docItem.id} className="flex flex-col">
                <CardHeader>
                  <CardTitle className="truncate">{docItem.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow flex items-center justify-center">
                  <a
                    href={docItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <BookOpen className="h-16 w-16 text-muted-foreground hover:text-primary transition-colors" />
                  </a>
                </CardContent>
                <CardContent className="flex justify-between items-center gap-2">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => createSession(docItem.id)}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Session starten
                  </Button>
                  {user && user.uid === docItem.userId && (
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
                            Dadurch wird das Dokument dauerhaft gelöscht.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(docItem)}
                          >
                            Löschen
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
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
