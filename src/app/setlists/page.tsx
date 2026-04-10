'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ListMusic,
  Plus,
  Loader2,
  Lock,
  Globe,
  Pencil,
  Trash2,
  LogIn,
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useUser, useCollection, useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import type { Setlist, UserProfile } from '@/lib/types';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { UserNav } from '@/components/user-nav';

function SetlistsPageContent() {
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Setlist | null>(null);

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const setlistsRef = useMemoFirebase(
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
  const { data: setlists, loading: setlistsLoading } = useCollection<Setlist>(setlistsRef);

  const handleCreate = async () => {
    if (!user || !firestore || !newTitle.trim()) return;
    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(firestore, 'setlists'), {
        userId: user.uid,
        creatorName: userProfile?.displayName || user.displayName || user.email || 'Anonym',
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        songIds: [],
        isPublic: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({ title: 'Setliste erstellt', description: `"${newTitle.trim()}" wurde angelegt.` });
      setCreateDialogOpen(false);
      setNewTitle('');
      setNewDescription('');
      router.push(`/setlists/${docRef.id}`);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Setliste konnte nicht erstellt werden.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (setlist: Setlist) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'setlists', setlist.id));
      toast({ title: 'Setliste gelöscht', description: `"${setlist.title}" wurde entfernt.` });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Fehler', description: 'Setliste konnte nicht gelöscht werden.' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const loading = userLoading || profileLoading;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!user || !userProfile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-center p-4">
        <ListMusic className="h-16 w-16 text-primary mb-4" />
        <h2 className="text-2xl font-bold">Anmeldung erforderlich</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          Bitte melde dich an, um deine Setlisten zu sehen.
        </p>
        <Button onClick={() => router.push('/auth')}>
          <LogIn className="mr-2" />
          Anmelden
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 sm:p-6 flex justify-between items-center border-b sticky top-0 bg-card/60 backdrop-blur-sm z-10">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => router.push('/')}
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shadow-sm">
            <ListMusic className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Setlisten</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/library')}>
            Zur Bibliothek
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-violet-500 hover:from-primary/90 hover:to-violet-500/90">
                <Plus className="mr-2 h-4 w-4" />
                Neue Setliste
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Setliste erstellen</DialogTitle>
                <DialogDescription>
                  Gib einen Titel und eine optionale Beschreibung für deine neue Setliste ein.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="setlist-title">Titel *</Label>
                  <Input
                    id="setlist-title"
                    placeholder="z.B. Weihnachtskonzert 2024"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setlist-desc">Beschreibung (optional)</Label>
                  <Textarea
                    id="setlist-desc"
                    placeholder="Kurze Beschreibung der Setliste..."
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleCreate} disabled={!newTitle.trim() || isCreating}>
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Erstellen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <UserNav />
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {setlistsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-5 w-3/4 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                </CardHeader>
                <CardFooter>
                  <div className="h-10 w-full bg-muted rounded-md animate-pulse" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : setlists && setlists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {setlists.map((setlist) => (
              <Card
                key={setlist.id}
                className="flex flex-col cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => router.push(`/setlists/${setlist.id}`)}
              >
                <CardHeader className="flex-grow pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate leading-tight">{setlist.title}</CardTitle>
                      {setlist.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {setlist.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={setlist.isPublic ? 'default' : 'secondary'} className="shrink-0 flex items-center gap-1">
                      {setlist.isPublic ? (
                        <><Globe className="h-3 w-3" /> Öffentlich</>
                      ) : (
                        <><Lock className="h-3 w-3" /> Privat</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-2">
                  <p className="text-sm text-muted-foreground">
                    {setlist.songIds?.length ?? 0} {(setlist.songIds?.length ?? 0) === 1 ? 'Song' : 'Songs'}
                  </p>
                </CardContent>
                <CardFooter className="pt-0 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/setlists/${setlist.id}`);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Bearbeiten
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(setlist);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <ListMusic className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium text-muted-foreground">
              Noch keine Setlisten
            </h3>
            <p className="mt-1 text-sm text-muted-foreground mb-6">
              Erstelle deine erste Setliste, um Songs zu sammeln.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Neue Setliste
            </Button>
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Setliste löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Setliste &quot;{deleteTarget?.title}&quot; wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SetlistsPage() {
  return (
    <FirebaseClientProvider>
      <SetlistsPageContent />
    </FirebaseClientProvider>
  );
}
