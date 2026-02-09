import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFirebaseConfig } from './config';

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

export function initializeFirebase() {
  if (getApps().length === 0) {
    const firebaseConfig = getFirebaseConfig();
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    firestore = getFirestore(app);
  }
  return { app, auth, firestore };
}

export * from './auth/use-user';
export * from './client-provider';
export * from './context';
export * from './error-emitter';
export * from './errors';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './provider';
export * from './storage';
export * from './use-firebase';
export * from './use-memo-firebase';
