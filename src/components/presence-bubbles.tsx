'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import type { PresenceEntry } from '@/lib/types';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PresenceBubblesProps {
  sessionId: string;
}

const MAX_SHOWN = 5;
const STALE_THRESHOLD_MS = 60_000; // 60 seconds

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function PresenceBubbles({ sessionId }: PresenceBubblesProps) {
  const { firestore } = useFirebase();
  const [entries, setEntries] = useState<PresenceEntry[]>([]);

  useEffect(() => {
    if (!firestore || !sessionId) return;

    const presenceRef = collection(
      firestore,
      'sessions',
      sessionId,
      'presence'
    );

    const unsubscribe = onSnapshot(
      presenceRef,
      (snapshot) => {
        const now = Date.now();
        const active: PresenceEntry[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data() as PresenceEntry;
          let lastSeenMs: number;

          if (data.lastSeen instanceof Timestamp) {
            lastSeenMs = data.lastSeen.toMillis();
          } else if (data.lastSeen?.seconds) {
            lastSeenMs = data.lastSeen.seconds * 1000;
          } else {
            lastSeenMs = 0;
          }

          if (now - lastSeenMs < STALE_THRESHOLD_MS) {
            active.push(data);
          }
        });

        setEntries(active);
      },
      (error) => {
        // Silently ignore permission errors for presence subcollection
        console.warn('Presence snapshot error:', error.code);
      }
    );

    return () => unsubscribe();
  }, [firestore, sessionId]);

  if (entries.length === 0) return null;

  const shown = entries.slice(0, MAX_SHOWN);
  const overflow = entries.length - MAX_SHOWN;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center">
        <div className="flex -space-x-2">
          {shown.map((entry, i) => (
            <Tooltip key={entry.userId}>
              <TooltipTrigger asChild>
                <Avatar
                  className="h-7 w-7 border-2 border-background cursor-default"
                  style={{ zIndex: MAX_SHOWN - i }}
                >
                  {entry.photoURL ? (
                    <AvatarImage src={entry.photoURL} alt={entry.displayName} />
                  ) : null}
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {getInitials(entry.displayName || '?')}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{entry.displayName || 'Unbekannter Nutzer'}</p>
              </TooltipContent>
            </Tooltip>
          ))}

          {overflow > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar
                  className="h-7 w-7 border-2 border-background cursor-default"
                  style={{ zIndex: 0 }}
                >
                  <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                    +{overflow}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>und {overflow} weitere</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
