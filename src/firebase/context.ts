import { createContext, useContext } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Auth, User } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

export interface FirebaseContextValue {
  app: FirebaseApp | null;
  auth: Auth | null;
  firestore: Firestore | null;
  user: User | null;
}

export const FirebaseContext = createContext<FirebaseContextValue | null>(null);
export const FirebaseAppContext = createContext<FirebaseApp | null>(null);
export const FirestoreContext = createContext<Firestore | null>(null);
export const AuthContext = createContext<Auth | null>(null);
export const UserContext = createContext<User | null>(null);

export const useFirebaseContext = () => {
  return useContext(FirebaseContext);
};
