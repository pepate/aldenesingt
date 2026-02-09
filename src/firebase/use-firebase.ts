'use client';
import { useContext } from 'react';
import {
  FirebaseContext,
  FirebaseAppContext,
  FirestoreContext,
  AuthContext,
} from './context';

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    // Return null instead of throwing an error
    return { app: null, auth: null, firestore: null, user: null };
  }
  return context;
};

export const useFirebaseApp = () => {
  const context = useContext(FirebaseAppContext);
  return context;
};

export const useFirestore = () => {
  const context = useContext(FirestoreContext);
  return context;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context;
};
