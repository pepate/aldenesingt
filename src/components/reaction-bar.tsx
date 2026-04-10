'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import type { Reaction } from '@/lib/types';
import { cn } from '@/lib/utils';

const EMOJIS: Reaction['emoji'][] = ['👏', '🔥', '❤️'];
const WINDOW_MS = 30_000; // 30 seconds for count display
const CLEANUP_AGE_MS = 60_000; // delete reactions older than 60s

interface ReactionBarProps {
  sessionId: string;
  isHost: boolean;
  userId?: string;
}

interface ReactionDoc extends Omit<Reaction, 'id'> {
  id: string;
  createdAt: Timestamp | null;
}

export default function ReactionBar({
  sessionId,
  isHost,
  userId,
}: ReactionBarProps) {
  const { firestore } = useFirebase();
  const [reactions, setReactions] = useState<ReactionDoc[]>([]);
  const [pulse, setPulse] = useState(false);

  const reactionsRef = firestore
    ? collection(firestore, 'sessions', sessionId, 'reactions')
    : null;

  useEffect(() => {
    if (!reactionsRef) return;

    const q = query(reactionsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const now = Date.now();
        const docs: ReactionDoc[] = [];

        snapshot.forEach((d) => {
          const data = d.data();
          docs.push({
            id: d.id,
            emoji: data.emoji,
            userId: data.userId,
            createdAt: data.createdAt,
          });
        });

        setReactions(docs);

        // Trigger pulse for host when new reactions arrive
        if (isHost && docs.some((r) => {
          const ms = r.createdAt instanceof Timestamp
            ? r.createdAt.toMillis()
            : (r.createdAt as any)?.seconds * 1000 ?? 0;
          return now - ms < 3000; // reaction in last 3 seconds
        })) {
          setPulse(true);
          setTimeout(() => setPulse(false), 1000);
        }
      },
      (error) => {
        console.warn('Reaction snapshot error:', error.code);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore, sessionId, isHost]);

  const cleanupOldReactions = useCallback(
    async (allReactions: ReactionDoc[]) => {
      if (!firestore) return;
      const now = Date.now();
      const toDelete = allReactions.filter((r) => {
        const ms =
          r.createdAt instanceof Timestamp
            ? r.createdAt.toMillis()
            : (r.createdAt as any)?.seconds * 1000 ?? 0;
        return now - ms > CLEANUP_AGE_MS;
      });

      for (const r of toDelete) {
        try {
          await deleteDoc(
            doc(firestore, 'sessions', sessionId, 'reactions', r.id)
          );
        } catch {
          // Silently ignore cleanup errors
        }
      }
    },
    [firestore, sessionId]
  );

  const handleReact = async (emoji: Reaction['emoji']) => {
    if (!reactionsRef || !userId) return;

    try {
      await addDoc(reactionsRef, {
        emoji,
        userId,
        createdAt: serverTimestamp(),
      });

      // Trigger async cleanup after writing
      cleanupOldReactions(reactions);
    } catch (error) {
      console.warn('Failed to add reaction:', error);
    }
  };

  // Count reactions per emoji in the last WINDOW_MS
  const counts = EMOJIS.reduce<Record<string, number>>((acc, emoji) => {
    const now = Date.now();
    acc[emoji] = reactions.filter((r) => {
      if (r.emoji !== emoji) return false;
      const ms =
        r.createdAt instanceof Timestamp
          ? r.createdAt.toMillis()
          : (r.createdAt as any)?.seconds * 1000 ?? 0;
      return now - ms < WINDOW_MS;
    }).length;
    return acc;
  }, {});

  const totalRecent = EMOJIS.reduce((sum, e) => sum + counts[e], 0);

  // Host sees counts but no send buttons; guests see send buttons
  if (isHost) {
    if (totalRecent === 0) return null;

    return (
      <div
        className={cn(
          'fixed bottom-4 left-1/2 -translate-x-1/2 z-40',
          'flex items-center gap-2 px-4 py-2 rounded-full',
          'bg-background/90 backdrop-blur-sm border shadow-lg',
          pulse && 'animate-pulse'
        )}
      >
        {EMOJIS.map((emoji) =>
          counts[emoji] > 0 ? (
            <span key={emoji} className="flex items-center gap-1 text-sm">
              <span className="text-lg">{emoji}</span>
              <span className="font-semibold text-muted-foreground">
                {counts[emoji]}
              </span>
            </span>
          ) : null
        )}
      </div>
    );
  }

  // Guest reaction bar
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-background/90 backdrop-blur-sm border shadow-lg">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReact(emoji)}
          className={cn(
            'relative flex flex-col items-center gap-0.5 p-2 rounded-full',
            'hover:bg-muted transition-colors active:scale-90'
          )}
          aria-label={`Reagieren mit ${emoji}`}
        >
          <span className="text-2xl leading-none">{emoji}</span>
          {counts[emoji] > 0 && (
            <span className="text-xs font-semibold text-muted-foreground leading-none">
              {counts[emoji]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
