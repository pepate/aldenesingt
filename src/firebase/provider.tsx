'use client';
import { FirebaseApp } from 'firebase/app';
import { Auth, User } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import React, { PropsWithChildren, useMemo } from 'react';
import {
  FirebaseAppContext,
  FirebaseContext,
  FirestoreContext,
  AuthContext,
  UserContext,
} from './context';
import { useMemoFirebase } from './use-memo-firebase';

export interface FirebaseProviderProps {
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user?: User;
}

export const FirebaseProvider: React.FC<
  PropsWithChildren<FirebaseProviderProps>
> = ({ app, firestore, auth, user, children }) => {
  const appContextValue = useMemoFirebase(() => app, [app]);
  const firestoreContextValue = useMemoFirebase(() => firestore, [firestore]);
  const authContextValue = useMemoFirebase(() => auth, [auth]);
  const userContextValue = useMemoFirebase(() => user, [user]);

  const contextValue = useMemo(
    () => ({
      app: appContextValue,
      firestore: firestoreContextValue,
      auth: authContextValue,
      user: userContextValue,
    }),
    [appContextValue, firestoreContextValue, authContextValue, userContextValue]
  );

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseAppContext.Provider value={appContextValue}>
        <FirestoreContext.Provider value={firestoreContextValue}>
          <AuthContext.Provider value={authContextValue}>
            <UserContext.Provider value={userContextValue}>
              {children}
            </UserContext.Provider>
          </AuthContext.Provider>
        </FirestoreContext.Provider>
      </FirebaseAppContext.Provider>
    </FirebaseContext.Provider>
  );
};
