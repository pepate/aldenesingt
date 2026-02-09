'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  DocumentReference,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import type { Session, Song, SongSheet, SongPart } from '@/lib/types';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { transposeSongSheet } from '@/lib/transpose';
import { cloneDeep } from 'lodash';
import { Input } from './ui/input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface SongViewerProps {
  song: Song;
  sessionId: string;
  isHost: boolean;
  sessionRef: DocumentReference<Session> | null;
  initialScroll: number;
  transpose: number;
  isEditing: boolean;
  sheet: SongSheet;
  onSheetChange: (sheet: SongSheet) => void;
  showChords: boolean;
}

const DEBOUNCE_TIME = 200;

export default function SongViewer({
  song,
  isHost,
  sessionRef,
  initialScroll,
  transpose,
  isEditing,
  sheet,
  onSheetChange,
  showChords,
}: SongViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUpdatingByListener = useRef(false);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Memoize the transposed content for view mode.
  const transposedSheet = useMemo(() => {
    if (!song.sheet) return null;
    return transposeSongSheet(song.sheet, transpose);
  }, [song.sheet, transpose]);

  const displaySheet = isEditing ? sheet : transposedSheet;

  // In edit mode, group parts by type (Verse, Chorus, etc.)
  const uniqueParts = useMemo(() => {
    if (!isEditing || !sheet?.song) return [];
    
    const partMap = new Map<string, { part: SongPart, originalIndex: number }>();
    
    sheet.song.forEach((part, index) => {
      // "Verse 1" -> "Verse", "Chorus" -> "Chorus"
      const basePartName = part.part.replace(/\s+\d+$/, '').trim();
      if (!partMap.has(basePartName)) {
        partMap.set(basePartName, { part: part, originalIndex: index });
      }
    });

    return Array.from(partMap.values());
  }, [sheet, isEditing]);

  // Reset scroll when content changes (excluding edits)
  useEffect(() => {
    if (scrollContainerRef.current && !isEditing) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [song.id, isEditing]);

  const sendScrollUpdate = useCallback(
    (scrollTop: number) => {
      if (sessionRef) {
        const updateData = {
          scroll: scrollTop,
          lastActivity: serverTimestamp(),
        };
        updateDoc(sessionRef, updateData).catch(async (error) => {
          if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
              path: sessionRef.path,
              operation: 'update',
              requestResourceData: updateData,
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
    if (isHost && !isEditing) {
      debouncedSendScroll(e.currentTarget.scrollTop);
    }
  };

  // Listener for non-hosts to receive scroll updates
  useEffect(() => {
    if (isHost || !sessionRef || isEditing) return;

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
  }, [isHost, sessionRef, isEditing]);

  // Set initial scroll position
  useEffect(() => {
    if (scrollContainerRef.current && !isEditing) {
      scrollContainerRef.current.scrollTop = initialScroll;
    }
  }, [initialScroll, isEditing]);

  const handleChordChange = (
    partIndex: number, // The index OF THE REPRESENTATIVE PART in the original song array
    lineIndex: number,
    value: string
  ) => {
    const newSheet = cloneDeep(sheet);
    const representativePart = newSheet.song[partIndex];
    if (!representativePart) return;

    // "Verse 1" -> "Verse"; "Chorus" -> "Chorus"
    const basePartName = representativePart.part.replace(/\s+\d+$/, "").trim();

    // Apply the change to all similar parts
    newSheet.song.forEach((part) => {
      const currentBasePartName = part.part.replace(/\s+\d+$/, "").trim();
      if (currentBasePartName === basePartName) {
        if (part.lines.length > lineIndex) {
          part.lines[lineIndex].chords = value;
        }
      }
    });

    onSheetChange(newSheet);
  };

  if (!displaySheet) {
    return <div className="p-4">Song-Daten werden geladen...</div>;
  }

  if (isEditing) {
    return (
        <div
        className="h-full w-full overflow-y-auto bg-background p-4 sm:p-6 md:p-8"
        >
            <div className="max-w-2xl mx-auto">
                <Tabs defaultValue={uniqueParts[0]?.part.part.replace(/\s+\d+$/, '').trim()}>
                <TabsList className="mb-4">
                    {uniqueParts.map(({ part }) => {
                        const basePartName = part.part.replace(/\s+\d+$/, '').trim();
                        return (
                            <TabsTrigger key={basePartName} value={basePartName}>
                            {basePartName}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>

                {uniqueParts.map(({ part, originalIndex }) => {
                    const basePartName = part.part.replace(/\s+\d+$/, '').trim();
                    return (
                    <TabsContent key={basePartName} value={basePartName}>
                        <div className="space-y-4">
                        {part.lines.map((line, lineIndex) => (
                            <div
                            key={lineIndex}
                            className="flex flex-col gap-1 font-code text-sm sm:text-base"
                            >
                            <Input
                                type="text"
                                value={line.chords}
                                onChange={(e) =>
                                handleChordChange(originalIndex, lineIndex, e.target.value)
                                }
                                className="font-code text-primary font-bold bg-muted/50 border-primary/20 h-8"
                                placeholder="Akkorde..."
                            />
                            <Input
                                type="text"
                                value={line.text}
                                disabled
                                className="font-code bg-muted/50 h-8"
                            />
                            </div>
                        ))}
                        </div>
                    </TabsContent>
                    );
                })}
                </Tabs>
            </div>
        </div>
    );
  }

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
      <div className="max-w-2xl mx-auto">
        <div className="mb-4">
          <p>
            <span className="font-bold">Erscheinungsdatum:</span>{' '}
            {displaySheet.releaseDate}
          </p>
          <p>
            <span className="font-bold">Genre:</span> {displaySheet.genre}
          </p>
          <p>
            <span className="font-bold">Tonart:</span> {displaySheet.key}
          </p>
        </div>

        {displaySheet.song.map((part, partIndex) => (
          <div key={partIndex} className="mb-6">
            <h3 className="font-bold text-lg mb-2 border-b pb-1">
              {part.part}
            </h3>
            {part.lines.map((line, lineIndex) => (
              <div
                key={lineIndex}
                className="flex flex-col mb-1 font-code text-sm sm:text-base"
              >
                {showChords &&
                  line.chords && (
                    <div className="text-primary font-bold whitespace-pre-wrap">
                      {line.chords}
                    </div>
                  )
                }
                <div className="whitespace-pre-wrap">{line.text}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
