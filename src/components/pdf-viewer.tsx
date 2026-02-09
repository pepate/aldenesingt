'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DocumentReference, onSnapshot, updateDoc } from 'firebase/firestore';
import type { Session } from '@/lib/types';

interface PdfViewerProps {
  songUrl: string;
  sessionId: string;
  isHost: boolean;
  sessionRef: DocumentReference<Session> | null;
  initialScroll: number;
}

const DEBOUNCE_TIME = 200; // ms

export default function PdfViewer({
  songUrl,
  isHost,
  sessionRef,
  initialScroll,
}: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUpdatingByListener = useRef(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [pdfKey, setPdfKey] = useState(songUrl);
  const [isLoading, setIsLoading] = useState(true);

  // Update PDF when URL changes
  useEffect(() => {
    setIsLoading(true);
    setPdfKey(songUrl);
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
    }
  }, [songUrl]);

  const sendScrollUpdate = useCallback(
    async (scrollTop: number) => {
      if (sessionRef) {
        try {
          await updateDoc(sessionRef, { scroll: scrollTop });
        } catch (error) {
          console.error('Failed to send scroll update:', error);
        }
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
    const scrollTop = e.currentTarget.scrollTop;
    debouncedSendScroll(scrollTop);
  };

  // Set up Firestore listener for scroll changes
  useEffect(() => {
    if (isHost || !sessionRef) return;

    const unsubscribe = onSnapshot(sessionRef, (doc) => {
      const newScroll = doc.data()?.scroll;
      const container = scrollContainerRef.current;
      if (
        container &&
        newScroll !== undefined &&
        Math.abs(container.scrollTop - newScroll) > 5
      ) {
        isUpdatingByListener.current = true;
        container.scrollTo({ top: newScroll, behavior: 'smooth' });
      }
    });

    return () => unsubscribe();
  }, [isHost, sessionRef]);

  // Set initial scroll position
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = initialScroll;
    }
  }, [initialScroll, pdfKey]);


  const onPdfLoad = () => {
    setIsLoading(false);
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full w-full overflow-y-auto"
      onScroll={isHost ? handleScroll : undefined}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: 'hsl(var(--primary)) hsl(var(--background))',
      }}
    >
      <div className="relative w-full min-h-full">
        {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-2 text-muted-foreground">Dokument wird geladen...</p>
            </div>
        )}
        <iframe
          key={pdfKey}
          src={`${songUrl}#toolbar=0&navpanes=0`}
          title="PDF-Dokument"
          frameBorder="0"
          className="w-full relative z-10"
          style={{ height: '500vh' }}
          onLoad={onPdfLoad}
        />
      </div>
    </div>
  );
}
