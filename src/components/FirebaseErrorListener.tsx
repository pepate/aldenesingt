'use client';

import React, { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: any) => {
      console.error('Firebase Permission Error:', error);
      toast({
        variant: 'destructive',
        title: 'Berechtigungsfehler',
        description: error.message || 'Bei einer Firebase-Operation ist ein Fehler aufgetreten.',
      });
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
