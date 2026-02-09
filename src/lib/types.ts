export type Song = {
  id: string;
  title: string;
  content: string;
  userId: string;
  createdAt: any;
  storagePath?: string;
};

export type Session = {
  id: string;
  songId: string;
  scroll: number;
  hostId: string;
  transpose: number;
  createdAt: any;
};

export type SessionParticipant = {
  id: string;
  userId: string;
  sessionId: string;
  joinedAt: any;
  displayName: string | null;
  photoURL: string | null;
};
