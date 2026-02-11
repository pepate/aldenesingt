'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Loader2,
  Users,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

import { FirebaseClientProvider } from '@/firebase/client-provider';
import {
  useUser,
  useCollection,
  useFirebase,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { UserNav } from '@/components/user-nav';

const roleConfig: {
  [key in UserProfile['role']]: { label: string; icon: React.ElementType };
} = {
  admin: { label: 'Admin', icon: Shield },
  creator: { label: 'Creator', icon: UserCheck },
  user: { label: 'User', icon: UserCog },
};

function AdminPage() {
  const { user, loading: userLoading } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);

  const currentUserProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: currentUserProfile, loading: profileLoading } =
    useDoc<UserProfile>(currentUserProfileRef);

  const usersRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const {
    data: fetchedUsers,
    loading: usersLoading,
    error: usersError,
  } = useCollection<UserProfile>(usersRef);

  useEffect(() => {
    // Wait until both loading states are false
    if (userLoading || profileLoading) {
      return;
    }

    // Now, perform the check
    if (!currentUserProfile || currentUserProfile.role !== 'admin') {
      toast({
        variant: 'destructive',
        title: 'Zugriff verweigert',
        description: 'Sie haben keine Berechtigung für diese Seite.',
      });
      router.push('/');
    }
  }, [userLoading, profileLoading, currentUserProfile, router, toast]);

  useEffect(() => {
    if (fetchedUsers) {
      // Sort by creation date descending
      const sorted = [...fetchedUsers].sort((a, b) => {
        const dateA = a.createdAt?.toDate() || 0;
        const dateB = b.createdAt?.toDate() || 0;
        if (dateA > dateB) return -1;
        if (dateA < dateB) return 1;
        return 0;
      });
      setUserProfiles(sorted);
    }
  }, [fetchedUsers]);

  const handleRoleChange = async (
    userId: string,
    newRole: UserProfile['role']
  ) => {
    if (!firestore) return;
    try {
      const userDocRef = doc(firestore, 'users', userId);
      await updateDoc(userDocRef, { role: newRole });
      toast({
        title: 'Rolle aktualisiert',
        description: `Die Rolle des Nutzers wurde erfolgreich auf "${newRole}" geändert.`,
      });
    } catch (error: any) {
      console.error('Failed to update role:', error);
      toast({
        variant: 'destructive',
        title: 'Update fehlgeschlagen',
        description: error.message || 'Die Rolle konnte nicht geändert werden.',
      });
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  const isLoading = userLoading || profileLoading;
  const isAuthorized = !isLoading && currentUserProfile?.role === 'admin';

  // Show a loader until authorization is confirmed, preventing content flash
  if (isLoading || !isAuthorized) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 sm:p-6 flex justify-between items-center border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">
            Benutzerverwaltung
          </h1>
        </div>
        <UserNav />
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        {usersError && (
          <p className="text-destructive">
            Fehler beim Laden der Benutzer: {usersError.message}
          </p>
        )}
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Benutzer</TableHead>
                <TableHead className="w-[25%]">Rolle</TableHead>
                <TableHead className="w-[25%]">Registriert am</TableHead>
                <TableHead className="text-right w-[15%]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersLoading &&
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ))}
              {!usersLoading &&
                userProfiles.map((userProfile) => (
                  <TableRow key={userProfile.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {userProfile.photoURL && (
                            <AvatarImage
                              src={userProfile.photoURL}
                              alt={userProfile.displayName || ''}
                            />
                          )}
                          <AvatarFallback>
                            {getInitials(userProfile.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {userProfile.displayName || 'Anonymer Benutzer'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {userProfile.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        {React.createElement(
                          roleConfig[userProfile.role].icon,
                          {
                            className: `h-3 w-3`,
                          }
                        )}
                        <span>{roleConfig[userProfile.role].label}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {userProfile.createdAt?.toDate
                        ? format(userProfile.createdAt.toDate(), 'PPP', {
                            locale: de,
                          })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {userProfile.role === 'admin' ? (
                        <span className="text-xs text-muted-foreground">
                          Nicht änderbar
                        </span>
                      ) : (
                        <Select
                          defaultValue={userProfile.role}
                          onValueChange={(newRole) =>
                            handleRoleChange(
                              userProfile.id,
                              newRole as UserProfile['role']
                            )
                          }
                        >
                          <SelectTrigger className="w-[120px] h-9">
                            <SelectValue placeholder="Rolle ändern" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="creator">Creator</SelectItem>
                            <SelectItem value="user">User</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        {!usersLoading && userProfiles.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">
              Keine Benutzer gefunden
            </h3>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Admin() {
  return (
    <FirebaseClientProvider>
      <AdminPage />
    </FirebaseClientProvider>
  );
}
