export type SongLine = {
  chords: string;
  text: string;
};

export type SongPart = {
  part: string;
  lines: SongLine[];
};

export type SongSheet = {
  releaseDate: string;
  genre: string;
  key: string;
  song: SongPart[];
};

export type Song = {
  id: string;
  userId: string;
  createdAt: any;
  title: string;
  artist: string;
  sheet: SongSheet;
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
