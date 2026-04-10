'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Music,
  Lock,
  Globe,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import type { Setlist, Song } from '@/lib/types';

export default function PublicSetlistPage() {
  const params = useParams();
  const router = useRouter();

  const setlistId = Array.isArray(params.setlistId) ? params.setlistId[0] : params.setlistId;

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs] = useState<Map<string, Song>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!setlistId) return;

    const load = async () => {
      try {
        const { firestore } = initializeFirebase();
        const setlistSnap = await getDoc(doc(firestore, 'setlists', setlistId));

        if (!setlistSnap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const data = { id: setlistSnap.id, ...setlistSnap.data() } as Setlist;

        if (!data.isPublic) {
          setIsPrivate(true);
          setLoading(false);
          return;
        }

        setSetlist(data);

        // Load songs
        if (data.songIds && data.songIds.length > 0) {
          const songMap = new Map<string, Song>();
          await Promise.all(
            data.songIds.map(async (songId) => {
              try {
                const songSnap = await getDoc(doc(firestore, 'songs', songId));
                if (songSnap.exists()) {
                  songMap.set(songId, { id: songSnap.id, ...songSnap.data() } as Song);
                }
              } catch {
                // Ignore individual song load failures
              }
            })
          );
          setSongs(songMap);
        }
      } catch (err) {
        console.error('Failed to load public setlist:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [setlistId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-center p-4">
        <Music className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Setliste nicht gefunden</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          Diese Setliste existiert nicht oder wurde gelöscht.
        </p>
        <Button onClick={() => router.push('/')}>Zur Startseite</Button>
      </div>
    );
  }

  if (isPrivate) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-center p-4">
        <Lock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold">Diese Setliste ist privat</h2>
        <p className="text-muted-foreground mt-2 mb-6">
          Der Eigentümer hat diese Setliste nicht öffentlich geteilt.
        </p>
        <Button onClick={() => router.push('/')}>Zur Startseite</Button>
      </div>
    );
  }

  if (!setlist) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-2xl flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Zur Startseite</span>
          </Button>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Music className="h-6 w-6 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate leading-tight">{setlist.title}</h1>
              {setlist.description && (
                <p className="text-sm text-muted-foreground truncate">{setlist.description}</p>
              )}
            </div>
          </div>
          <Badge variant="default" className="flex items-center gap-1 shrink-0">
            <Globe className="h-3 w-3" />
            Öffentlich
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl p-4 sm:p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Von {setlist.creatorName} &middot; {setlist.songIds?.length ?? 0}{' '}
          {(setlist.songIds?.length ?? 0) === 1 ? 'Song' : 'Songs'}
        </p>

        {setlist.songIds && setlist.songIds.length > 0 ? (
          <div className="space-y-2">
            {setlist.songIds.map((songId, index) => {
              const song = songs.get(songId);
              return (
                <button
                  key={songId}
                  className="w-full flex items-center gap-4 p-3 bg-card border rounded-lg hover:bg-accent transition-colors text-left group"
                  onClick={() => router.push(`/library/${songId}`)}
                >
                  <span className="text-sm text-muted-foreground font-mono w-6 shrink-0 text-center">
                    {index + 1}
                  </span>
                  {song?.artworkUrl ? (
                    <div className="relative w-12 h-12 rounded overflow-hidden shrink-0">
                      <Image
                        src={song.artworkUrl}
                        alt={song.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="48px"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 flex items-center justify-center bg-muted rounded shrink-0">
                      <Music className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {song ? (
                      <>
                        <p className="font-semibold truncate">{song.title}</p>
                        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-sm">Song wird geladen...</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Music className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-muted-foreground">Diese Setliste enthält noch keine Songs.</p>
          </div>
        )}
      </main>

      <footer className="p-4 text-center text-sm text-muted-foreground mt-8">
        <p>&copy; {new Date().getFullYear()} Aldene Singt</p>
      </footer>
    </div>
  );
}
