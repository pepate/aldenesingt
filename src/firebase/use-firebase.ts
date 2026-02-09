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
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useFirebaseApp = () => {
  const context = useContext(FirebaseAppContext);
  if (!context) {
    throw new Error('useFirebaseApp must be used within a FirebaseProvider');
  }
  return context;
};

export const useFirestore = () => {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error('useFirestore must be used within a FirebaseProvider');
  }
  return context;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a FirebaseProvider');
  }
  return context;
};
