'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';

interface PdfViewerProps {
  songUrl: string;
  sessionId: string;
  isHost: boolean;
}

const POLLING_INTERVAL = 300; // ms
const DEBOUNCE_TIME = 100; // ms

export default function PdfViewer({
  songUrl,
  sessionId,
  isHost,
}: PdfViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastSentScroll = useRef(0);
  const isUpdatingByPoll = useRef(false);

  // Debounce function to limit API calls on scroll
  const debounce = (func: (...args: any[]) => void, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  const sendScrollUpdate = useCallback(
    async (scrollTop: number) => {
      if (Math.abs(scrollTop - lastSentScroll.current) < 10) return; // Don't send minor changes
      lastSentScroll.current = scrollTop;
      try {
        await fetch(`/api/session/${sessionId}/scroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scroll: scrollTop }),
        });
      } catch (error) {
        console.error('Failed to send scroll update:', error);
      }
    },
    [sessionId]
  );

  const debouncedSendScroll = useCallback(debounce(sendScrollUpdate, DEBOUNCE_TIME), [sendScrollUpdate]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isUpdatingByPoll.current) {
        // This scroll was triggered by a poll update, so we don't send it back to the server
        isUpdatingByPoll.current = false;
        return;
    }
    const scrollTop = e.currentTarget.scrollTop;
    debouncedSendScroll(scrollTop);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (isHost) {
      container.addEventListener('scroll', handleScroll as any);
      return () => container.removeEventListener('scroll', handleScroll as any);
    }
  }, [isHost, handleScroll]);

  useEffect(() => {
    if (isHost) return;

    const pollScrollPosition = async () => {
      try {
        const response = await fetch(`/api/session/${sessionId}/scroll`);
        if (!response.ok) return;

        const { scroll: newScroll } = await response.json();
        const container = scrollContainerRef.current;
        if (container && Math.abs(container.scrollTop - newScroll) > 5) {
            isUpdatingByPoll.current = true;
            container.scrollTo({ top: newScroll, behavior: 'smooth' });
        }
      } catch (error) {
        console.error('Failed to poll scroll position:', error);
      }
    };

    const intervalId = setInterval(pollScrollPosition, POLLING_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isHost, sessionId]);

  return (
    <div
      ref={scrollContainerRef}
      className="h-full w-full overflow-y-auto"
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: 'hsl(var(--primary)) hsl(var(--background))',
      }}
    >
      <div className="relative w-full h-full">
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="ml-2 text-muted-foreground">Loading document...</p>
        </div>
        <embed
          src={`${songUrl}#toolbar=0&navpanes=0`}
          type="application/pdf"
          className="w-full relative z-10"
          style={{ height: '500vh' }} // Arbitrarily large height to ensure container scrolls
        />
      </div>
    </div>
  );
}
