'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DocumentReference, onSnapshot, updateDoc } from 'firebase/firestore';
import type { Session } from '@/lib/types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';

interface PdfViewerProps {
  songUrl: string;
  sessionId: string;
  isHost: boolean;
  sessionRef: DocumentReference<Session> | null;
  initialScroll: number;
}

const DEBOUNCE_TIME = 200;

export default function PdfViewer({
  songUrl,
  isHost,
  sessionRef,
  initialScroll,
}: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUpdatingByListener = useRef(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // By changing the key, we force the iframe to re-mount and load the new URL.
  const [pdfKey, setPdfKey] = useState(songUrl);
  useEffect(() => {
    setPdfKey(songUrl);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [songUrl]);

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
      isUpdatingByListener.current = false;
      return;
    }
    debouncedSendScroll(e.currentTarget.scrollTop);
  };

  // Listener for non-hosts
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
          Math.abs(container.scrollTop - newScroll) > 10
        ) {
          isUpdatingByListener.current = true;
          container.scrollTo({ top: newScroll, behavior: 'smooth' });
        }
      },
      async (error) => {
        // This is a read operation, so we emit a 'get' error
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

  // Set initial scroll
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = initialScroll;
    }
  }, [initialScroll, pdfKey]);

  return (
    <div
      ref={scrollContainerRef}
      className="h-full w-full overflow-y-auto bg-muted"
      onScroll={isHost ? handleScroll : undefined}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: 'hsl(var(--primary)) hsl(var(--background))',
      }}
    >
      <div className="w-full relative" style={{ height: '500vh' }}>
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
        <iframe
          key={pdfKey}
          src={songUrl ? `${songUrl}#toolbar=0&navpanes=0` : ''}
          title="PDF-Dokument"
          frameBorder="0"
          className="w-full h-full absolute top-0 left-0 z-10"
        />
      </div>
    </div>
  );
}
