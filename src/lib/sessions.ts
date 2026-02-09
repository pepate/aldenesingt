import type { Session } from '@/lib/types';

// In-memory store for sessions. In a real app, use a database.
const sessions = new Map<string, Session>();

export const createSession = (songId: string): string => {
  const sessionId = Math.random().toString(36).substring(2, 5).toUpperCase();
  // Avoid collision, though unlikely
  if (sessions.has(sessionId)) {
    return createSession(songId);
  }
  sessions.set(sessionId, { songId, scroll: 0 });
  return sessionId;
};

export const getSession = (sessionId: string): Session | undefined => {
  return sessions.get(sessionId.toUpperCase());
};

export const setScrollPosition = (
  sessionId: string,
  scroll: number
): boolean => {
  const session = getSession(sessionId);
  if (session) {
    sessions.set(sessionId.toUpperCase(), { ...session, scroll });
    return true;
  }
  return false;
};

export const getScrollPosition = (sessionId: string): number | undefined => {
  return getSession(sessionId)?.scroll;
};

export const updateSessionSong = (
  sessionId: string,
  songId: string
): boolean => {
  const session = getSession(sessionId);
  if (session) {
    // Reset scroll on song change
    sessions.set(sessionId.toUpperCase(), { ...session, songId, scroll: 0 });
    return true;
  }
  return false;
};
