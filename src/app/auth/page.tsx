'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAuth,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User as UserIcon, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function AuthPage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const auth = getAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
      toast({
        variant: 'destructive',
        title: 'Anmeldung fehlgeschlagen',
        description: 'Mit Google konnte nicht angemeldet werden.',
      });
    }
  };

  const handleAnonymousSignIn = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Error during anonymous sign-in:', error);
       toast({
        variant: 'destructive',
        title: 'Anmeldung fehlgeschlagen',
        description: 'Die anonyme Anmeldung ist fehlgeschlagen.',
      });
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Error during email sign-up:', error);
      toast({
        variant: 'destructive',
        title: 'Registrierung fehlgeschlagen',
        description: error.message,
      });
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Error during email sign-in:', error);
      toast({
        variant: 'destructive',
        title: 'Anmeldung fehlgeschlagen',
        description: error.message,
      });
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
      <Tabs defaultValue="login" className="w-full max-w-md">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">Anmelden</TabsTrigger>
          <TabsTrigger value="signup">Registrieren</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Anmelden</CardTitle>
              <CardDescription>
                Melden Sie sich bei Ihrem Konto an, um fortzufahren.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-Mail</Label>
                  <Input id="login-email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Passwort</Label>
                  <Input id="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">Mit E-Mail anmelden</Button>
              </form>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Oder weiter mit
                  </span>
                </div>
              </div>
              <Button className="w-full" variant="outline" onClick={handleGoogleSignIn}>
                <UserIcon className="mr-2" /> Mit Google anmelden
              </Button>
              <Button variant="secondary" className="w-full" onClick={handleAnonymousSignIn}>
                <Shield className="mr-2" /> Anonym anmelden
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="signup">
           <Card>
            <CardHeader>
              <CardTitle>Registrieren</CardTitle>
              <CardDescription>
                Erstellen Sie ein Konto, um loszulegen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-Mail</Label>
                  <Input id="signup-email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Passwort</Label>
                  <Input id="signup-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">Konto erstellen</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
