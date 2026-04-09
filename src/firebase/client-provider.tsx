'use client';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth, getAuth, onAuthStateChanged, User } from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { initializeFirebase } from '.';
import { FirebaseProvider } from './provider';

interface FirebaseContextValue {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  user: User | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [app, setApp] = useState<FirebaseApp | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [firestore, setFirestore] = useState<Firestore | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { app, auth, firestore } = initializeFirebase();
    setApp(app);
    setAuth(auth);
    setFirestore(firestore);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
           // User is signed in (regular or anonymous)
          if (firestore) {
            const userRef = doc(firestore, 'users', user.uid);
            const userDoc = await getDoc(userRef);

            if (!userDoc.exists()) {
              // If the user profile doesn't exist, create it.
              try {
                await setDoc(userRef, {
                  id: user.uid,
                  email: user.email,
                  displayName: user.displayName,
                  photoURL: user.photoURL,
                  createdAt: serverTimestamp(),
                  role: 'user', // Default role for all new users
                  songsGeneratedToday: 0,
                  lastGenerationDate: '',
                });
              } catch (error) {
                console.error("Failed to create user profile:", error);
              }
            }
          }
          setUser(user);
          setLoading(false);
        } else {
          // No user signed in — unauthenticated users can browse sessions.
          setUser(null);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Auth state change error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const memoizedValue = useMemo(() => {
    return { app, auth, firestore, user, loading };
  }, [app, auth, firestore, user, loading]);

  return (
    <FirebaseContext.Provider value={memoizedValue}>
      <FirebaseProvider
        app={app!}
        auth={auth!}
        firestore={firestore!}
        user={user!}
      >
        {children}
      </FirebaseProvider>
    </FirebaseContext.Provider>
  );
}

export const useFirebaseClient = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error(
      'useFirebaseClient must be used within a FirebaseClientProvider'
    );
  }
  return context;
};
