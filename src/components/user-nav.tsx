'use client';

import { useState } from 'react';
import { LogOut, Library, Shield, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut, updateProfile } from 'firebase/auth';
import {
  useAuth,
  useUser,
  useFirebase,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from './ui/skeleton';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';

export function UserNav() {
  const { user } = useUser();
  const auth = useAuth();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userProfile, loading: profileLoading } =
    useDoc<UserProfile>(userProfileRef);

  const handleSignOut = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/');
    }
  };

  const handleOpenEditDialog = () => {
    const currentName =
      userProfile?.displayName || user?.displayName || '';
    setNewDisplayName(currentName);
    setIsEditDialogOpen(true);
  };

  const handleUpdateProfile = async () => {
    if (!auth?.currentUser || !firestore || !newDisplayName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Fehler',
        description: 'Benutzername darf nicht leer sein.',
      });
      return;
    }

    const currentUser = auth.currentUser;
    const userDocRef = doc(firestore, 'users', currentUser.uid);

    try {
      // Update Firebase Auth profile
      await updateProfile(currentUser, { displayName: newDisplayName });

      // Update Firestore document
      await updateDoc(userDocRef, { displayName: newDisplayName });

      toast({
        title: 'Profil aktualisiert',
        description: 'Ihr Benutzername wurde erfolgreich geändert.',
      });
      setIsEditDialogOpen(false);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      toast({
        variant: 'destructive',
        title: 'Update fehlgeschlagen',
        description:
          error.message || 'Ihr Profil konnte nicht aktualisiert werden.',
      });
    }
  };

  if (!user) {
    return null;
  }

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    // Get initials from first and last name if available
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const canSeeAdmin = userProfile?.role === 'admin';
  const canSeeLibrary =
    userProfile?.role === 'creator' || userProfile?.role === 'admin';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-9 w-9 rounded-full">
            <Avatar className="h-9 w-9">
              {user.photoURL && (
                <AvatarImage
                  src={user.photoURL}
                  alt={user.displayName || 'Benutzer'}
                />
              )}
              <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              {profileLoading ? (
                <>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </>
              ) : (
                <>
                  <p className="text-sm font-medium leading-none">
                    {userProfile?.displayName || user.displayName || 'Benutzer'}
                  </p>
                  {user.email && (
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                </>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleOpenEditDialog}>
              <Pencil className="mr-2 h-4 w-4" />
              <span>Profil bearbeiten</span>
            </DropdownMenuItem>

            {profileLoading ? (
              <Skeleton className="h-8 w-full rounded-sm" />
            ) : (
              <>
                {canSeeLibrary && (
                  <DropdownMenuItem onClick={() => router.push('/library')}>
                    <Library className="mr-2 h-4 w-4" />
                    <span>Songs</span>
                  </DropdownMenuItem>
                )}
                {canSeeAdmin && (
                  <DropdownMenuItem onClick={() => router.push('/admin')}>
                    <Shield className="mr-2 h-4 w-4" />
                    <span>Benutzer verwalten</span>
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Abmelden</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Profil bearbeiten</DialogTitle>
            <DialogDescription>
              Ändern Sie hier Ihren Benutzernamen. Klicken Sie auf
              "Speichern", wenn Sie fertig sind.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="displayName" className="text-right">
                Benutzername
              </Label>
              <Input
                id="displayName"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button onClick={handleUpdateProfile}>Änderungen speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
