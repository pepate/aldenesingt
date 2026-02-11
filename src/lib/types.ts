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
  creatorName?: string;
  createdAt: any;
  title: string;
  artist: string;
  sheet: SongSheet;
  artworkUrl?: string;
};

export type Session = {
  id: string;
  songId: string;
  scroll: number;
  hostId: string;
  hostName: string;
  transpose: number;
  createdAt: any;
  lastActivity: any;
};

export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: any;
  role: 'admin' | 'creator' | 'user';
  songsGeneratedToday: number;
  lastGenerationDate: string; // YYYY-MM-DD
};
