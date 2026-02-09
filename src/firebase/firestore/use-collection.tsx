'use client';
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  Query,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
} from 'firebase/firestore';
import { useFirebase } from '../use-firebase';

export const useCollection = <T extends DocumentData>(query: Query | null) => {
  const { firestore } = useFirebase();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!query || !firestore) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot) => {
        const result: T[] = [];
        snapshot.forEach((doc) => {
          result.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(result);
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
  }, [query, firestore]);

  return { data, loading, error };
};
