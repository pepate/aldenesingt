'use client';
import { useEffect, useState } from 'react';
import {
  onSnapshot,
  DocumentReference,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { useFirebase } from '../use-firebase';

export const useDoc = <T extends DocumentData>(
  docRef: DocumentReference | null
) => {
  const { firestore } = useFirebase();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!docRef || !firestore) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot) => {
        if (snapshot.exists()) {
          setData({ id: snapshot.id, ...snapshot.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      },
      (err: FirestoreError) => {
        setError(err);
        setLoading(false);
        console.error(err);
      }
    );

    return () => unsubscribe();
  }, [docRef, firestore]);

  return { data, loading, error };
};
