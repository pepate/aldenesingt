export type Song = {
  id: string;
  title: string;
  url: string;
};

export type Session = {
  songId: string;
  scroll: number;
  hostId: string;
};

export type PdfDocument = {
  id: string;
  title: string;
  url: string;
  userId: string;
  createdAt: any;
  storagePath: string;
};

export type SessionParticipant = {
  id: string;
  userId: string;
  sessionId: string;
  joinedAt: any;
  displayName: string | null;
  photoURL: string | null;
};
