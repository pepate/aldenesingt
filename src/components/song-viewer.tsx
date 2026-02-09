'use client';

import { useRef, useEffect, useCallback } from 'react';
import { DocumentReference, onSnapshot, updateDoc } from 'firebase/firestore';
import type { Session } from '@/lib/types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

interface SongViewerProps {
  songContent: string;
  sessionId: string;
  isHost: boolean;
  sessionRef: DocumentReference<Session> | null;
  initialScroll: number;
}

const DEBOUNCE_TIME = 200;

export default function SongViewer({
  songContent,
  isHost,
  sessionRef,
  initialScroll,
}: SongViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUpdatingByListener = useRef(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Reset scroll when content changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [songContent]);

  const sendScrollUpdate = useCallback(
    (scrollTop: number) => {
      if (sessionRef) {
        updateDoc(sessionRef, { scroll: scrollTop }).catch(async (error) => {
          if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
              path: sessionRef.path,
              operation: 'update',
              requestResourceData: { scroll: scrollTop },
            });
            errorEmitter.emit('permission-error', permissionError);
          } else {
            console.error('Failed to send scroll update:', error);
          }
        });
      }
    },
    [sessionRef]
  );

  const debouncedSendScroll = useCallback(
    (scrollTop: number) => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      debounceTimeout.current = setTimeout(() => {
        sendScrollUpdate(scrollTop);
      }, DEBOUNCE_TIME);
    },
    [sendScrollUpdate]
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isUpdatingByListener.current) {
      isUpdatingByListener.current = false; // Reset flag after programmatic scroll
      return;
    }
    if(isHost) {
        debouncedSendScroll(e.currentTarget.scrollTop);
    }
  };

  // Listener for non-hosts to receive scroll updates
  useEffect(() => {
    if (isHost || !sessionRef) return;

    const unsubscribe = onSnapshot(
      sessionRef,
      (doc) => {
        const newScroll = doc.data()?.scroll;
        const container = scrollContainerRef.current;
        if (
          container &&
          newScroll !== undefined &&
          Math.abs(container.scrollTop - newScroll) > 10 // Threshold to prevent jitter
        ) {
          isUpdatingByListener.current = true;
          container.scrollTo({ top: newScroll, behavior: 'smooth' });
        }
      },
      async (error) => {
        if (error.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
            path: sessionRef.path,
            operation: 'get',
          });
          errorEmitter.emit('permission-error', permissionError);
        } else {
          console.error('Error on session snapshot listener:', error);
        }
      }
    );

    return () => unsubscribe();
  }, [isHost, sessionRef]);

  // Set initial scroll position
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = initialScroll;
    }
  }, [initialScroll]);


  return (
    <div
      ref={scrollContainerRef}
      className="h-full w-full overflow-y-auto bg-background p-4 sm:p-6 md:p-8"
      onScroll={handleScroll}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: 'hsl(var(--primary)) hsl(var(--background))',
      }}
    >
      <pre className="text-sm sm:text-base font-code whitespace-pre-wrap">
        {songContent}
      </pre>
    </div>
  );
}
