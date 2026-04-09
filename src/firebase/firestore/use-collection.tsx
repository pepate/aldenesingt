'use client';
import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  Query,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { useFirebase } from '../use-firebase';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

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
      async (err: FirestoreError) => {
        setError(err);
        setLoading(false);
        if (err.code === 'permission-denied' && query) {
          const path = (query as CollectionReference)?.path || 'Unbekannte Sammlung';
          const topLevel = path.split('/')[0];
          // Only surface permission errors for our own app collections.
          // Firebase SDK internals (e.g. 'groups') trigger their own Firestore
          // queries that we should not expose to the user as errors.
          const knownCollections = ['songs', 'sessions', 'users'];
          if (knownCollections.includes(topLevel)) {
            const permissionError = new FirestorePermissionError({
              path: path,
              operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
          } else {
            console.warn(`Firestore permission denied for internal/unknown collection: ${path}`);
          }
        } else {
            console.error(err);
        }
      }
    );

    return () => unsubscribe();
  }, [query, firestore]);

  return { data, loading, error };
};
