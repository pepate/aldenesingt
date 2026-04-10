'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Music, Plus, SkipForward, Trash2 } from 'lucide-react';
import type { Song } from '@/lib/types';
import Image from 'next/image';

interface SongQueuePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue: string[];
  allSongs: Song[];
  onQueueChange: (newQueue: string[]) => void;
  onNext: () => void;
}

interface SortableItemProps {
  id: string;
  song: Song | undefined;
  onRemove: (id: string) => void;
}

function SortableItem({ id, song, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border"
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        aria-label="Verschieben"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {song?.artworkUrl ? (
        <Image
          src={song.artworkUrl}
          alt={song.title}
          width={28}
          height={28}
          className="rounded-sm object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-7 h-7 flex items-center justify-center bg-muted rounded-sm text-muted-foreground flex-shrink-0">
          <Music className="h-4 w-4" />
        </div>
      )}

      <div className="flex-1 overflow-hidden min-w-0">
        <p className="text-sm font-medium truncate">
          {song?.title ?? 'Unbekannter Song'}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {song?.artist ?? ''}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(id)}
        aria-label="Aus Warteschlange entfernen"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function SongQueuePanel({
  open,
  onOpenChange,
  queue,
  allSongs,
  onQueueChange,
  onNext,
}: SongQueuePanelProps) {
  const [search, setSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const songMap = useMemo(() => {
    const map = new Map<string, Song>();
    allSongs.forEach((s) => map.set(s.id, s));
    return map;
  }, [allSongs]);

  const filteredSongs = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return allSongs;
    return allSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        s.artist.toLowerCase().includes(query)
    );
  }, [allSongs, search]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = queue.indexOf(active.id as string);
    const newIndex = queue.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    onQueueChange(arrayMove(queue, oldIndex, newIndex));
  };

  const handleAdd = (songId: string) => {
    if (!queue.includes(songId)) {
      onQueueChange([...queue, songId]);
    }
  };

  const handleRemove = (songId: string) => {
    onQueueChange(queue.filter((id) => id !== songId));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle>Song-Warteschlange</SheetTitle>
          <SheetDescription>
            Ziehe Songs um sie neu zu sortieren. Klicke auf &quot;Weiter&quot;, um zum nächsten Song zu wechseln.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-4 p-4">
          {/* Queue list */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Warteschlange ({queue.length})
              </h3>
              {queue.length > 0 && (
                <Button
                  size="sm"
                  onClick={onNext}
                  className="flex items-center gap-1.5"
                >
                  <SkipForward className="h-4 w-4" />
                  Weiter
                </Button>
              )}
            </div>

            {queue.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine Songs in der Warteschlange
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={queue}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-1.5">
                    {queue.map((songId) => (
                      <SortableItem
                        key={songId}
                        id={songId}
                        song={songMap.get(songId)}
                        onRemove={handleRemove}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Song search to add */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Song hinzufügen
            </h3>
            <Input
              placeholder="Song suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {filteredSongs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Kein Song gefunden.
                </p>
              ) : (
                filteredSongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handleAdd(song.id)}
                    disabled={queue.includes(song.id)}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {song.artworkUrl ? (
                      <Image
                        src={song.artworkUrl}
                        alt={song.title}
                        width={28}
                        height={28}
                        className="rounded-sm object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 flex items-center justify-center bg-muted rounded-sm text-muted-foreground flex-shrink-0">
                        <Music className="h-4 w-4" />
                      </div>
                    )}
                    <div className="flex-1 overflow-hidden min-w-0">
                      <p className="text-sm font-medium truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {song.artist}
                      </p>
                    </div>
                    {!queue.includes(song.id) && (
                      <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
