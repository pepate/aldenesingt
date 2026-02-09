'use client';
import { useFirebaseClient } from '../client-provider';

export const useUser = () => {
  const { user, loading } = useFirebaseClient();
  return { user, loading };
};
