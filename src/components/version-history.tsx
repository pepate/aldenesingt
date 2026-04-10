'use client';

import { useState } from 'react';
import type { SongVersion, SongSheet } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, RotateCcw } from 'lucide-react';

interface VersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: SongVersion[];
  onRestore: (version: SongVersion) => void;
}

function formatDate(timestamp: any): string {
  if (!timestamp) return 'Unbekannt';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Unbekannt';
  }
}

function getSheetPreview(sheet: SongSheet): string {
  if (!sheet?.song?.length) return '(Leer)';
  const parts = sheet.song.slice(0, 2);
  return parts.map((p) => p.part).join(', ');
}

export function VersionHistory({
  open,
  onOpenChange,
  versions,
  onRestore,
}: VersionHistoryProps) {
  const [confirmVersion, setConfirmVersion] = useState<SongVersion | null>(null);

  const handleRestoreClick = (version: SongVersion) => {
    setConfirmVersion(version);
  };

  const handleConfirmRestore = () => {
    if (confirmVersion) {
      onRestore(confirmVersion);
      setConfirmVersion(null);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Versionshistorie
            </DialogTitle>
          </DialogHeader>

          {(versions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Keine gespeicherten Versionen vorhanden.
            </p>
          ) : (
            <ScrollArea className="max-h-[400px] pr-2">
              <div className="space-y-3">
                {(versions ?? []).map((version, index) => (
                  <div
                    key={version.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs shrink-0">
                          Version {versions.length - index}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate">
                          {formatDate(version.savedAt)}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">
                        {version.title}
                        {version.artist ? ` – ${version.artist}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Teile: {getSheetPreview(version.sheet)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => handleRestoreClick(version)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Wiederherstellen
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmVersion}
        onOpenChange={(o) => { if (!o) setConfirmVersion(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Version wiederherstellen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Editor wird auf diese Version zurückgesetzt. Die Änderung wird
              erst beim Speichern übernommen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmVersion(null)}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore}>
              Wiederherstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
