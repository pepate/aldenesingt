'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { useUser } from '@/firebase';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, User as UserIcon, Shield } from 'lucide-react';

function AuthPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const auth = getAuth();

  useEffect(() => {
    if (!loading && user) {
      router.push('/library');
    }
  }, [user, loading, router]);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error during Google sign-in:', error);
    }
  };
  
    const handleAnonymousSignIn = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Error during anonymous sign-in:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Anmelden</CardTitle>
          <CardDescription>
            Wählen Sie eine Anmeldemethode, um fortzufahren.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" onClick={handleGoogleSignIn}>
            <UserIcon className="mr-2" /> Mit Google anmelden
          </Button>
          <Button variant="secondary" className="w-full" onClick={handleAnonymousSignIn}>
             <Shield className="mr-2" /> Anonym anmelden
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Auth() {
    return (
        <FirebaseClientProvider>
            <AuthPage />
        </FirebaseClientProvider>
    )
}
