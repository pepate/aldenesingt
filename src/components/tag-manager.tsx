'use client';

import { useState } from 'react';
import { Plus, X, Tag as TagIcon } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { SongTag } from '@/lib/types';

interface TagManagerProps {
  firestore: Firestore;
  userId: string;
  songId: string;
  songTagIds: string[];         // tag IDs currently on this song
  allTags: SongTag[];           // all tags for this user
  onTagsChange?: () => void;
}

export function TagManager({
  firestore,
  userId,
  songId,
  songTagIds,
  allTags,
  onTagsChange,
}: TagManagerProps) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [creating, setCreating] = useState(false);

  const assignedTags = allTags.filter((t) => songTagIds.includes(t.id));

  const handleCreateAndAssign = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const docRef = await addDoc(collection(firestore, 'tags'), {
        userId,
        label: newLabel.trim(),
        color: newColor,
        createdAt: serverTimestamp(),
      });
      // Assign to song
      await updateDoc(doc(firestore, 'songs', songId), {
        tags: arrayUnion(docRef.id),
      });
      setNewLabel('');
      onTagsChange?.();
    } finally {
      setCreating(false);
    }
  };

  const handleToggleTag = async (tag: SongTag) => {
    const isAssigned = songTagIds.includes(tag.id);
    if (isAssigned) {
      await updateDoc(doc(firestore, 'songs', songId), {
        tags: arrayRemove(tag.id),
      });
    } else {
      await updateDoc(doc(firestore, 'songs', songId), {
        tags: arrayUnion(tag.id),
      });
    }
    onTagsChange?.();
  };

  const handleDeleteTag = async (tagId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDoc(doc(firestore, 'tags', tagId));
    // Also remove from song if assigned
    if (songTagIds.includes(tagId)) {
      await updateDoc(doc(firestore, 'songs', songId), {
        tags: arrayRemove(tagId),
      });
    }
    onTagsChange?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <TagIcon className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold mb-2">Labels</p>

        {/* Existing tags */}
        <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
          {allTags.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Noch keine Labels erstellt.
            </p>
          )}
          {allTags.map((tag) => {
            const isAssigned = songTagIds.includes(tag.id);
            return (
              <div
                key={tag.id}
                className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-accent cursor-pointer"
                onClick={() => handleToggleTag(tag)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span
                    className={`text-sm truncate ${
                      isAssigned ? 'font-medium' : ''
                    }`}
                  >
                    {tag.label}
                  </span>
                </div>
                <button
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={(e) => handleDeleteTag(tag.id, e)}
                  title="Label löschen"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Create new tag */}
        <div className="border-t pt-2 space-y-2">
          <Label className="text-xs">Neues Label</Label>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Name..."
              className="h-7 text-xs flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateAndAssign();
              }}
            />
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border border-input bg-background p-0.5"
              title="Farbe wählen"
            />
            <Button
              size="sm"
              className="h-7 px-2"
              onClick={handleCreateAndAssign}
              disabled={creating || !newLabel.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Small badge pills to show on song cards */
export function TagPills({ tags }: { tags: SongTag[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ backgroundColor: tag.color }}
        >
          {tag.label}
        </span>
      ))}
    </div>
  );
}
