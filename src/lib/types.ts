export type SongLine = {
  chords: string;
  text: string;
};

export type SongPart = {
  part: string;
  lines: SongLine[];
  sectionLabel?: string;  // e.g. 'Verse' | 'Chorus' | 'Bridge' | 'Intro' | 'Outro' | 'Solo'
  sectionColor?: string;  // e.g. '#3b82f6'
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
  pageImageUrls?: string[];
  capo?: number;
  bpm?: number;
  tags?: string[];        // array of tag IDs
  playCount?: number;
};

export type Session = {
  id: string;
  songId: string;
  scroll: number;
  hostId: string;
  hostName: string;
  transpose: number;
  displayMode?: 'text' | 'image';
  queue?: string[];       // ordered array of songIds pre-queued by host
  capo?: number;
  bpm?: number;
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
  favourites?: string[];      // array of songIds
  fontSizeIndex?: number;     // 0–4
  recentlyPlayed?: RecentPlay[];
};

export type SongTag = {
  id: string;
  userId: string;
  label: string;
  color: string;
  createdAt: any;
};

export type Setlist = {
  id: string;
  userId: string;
  creatorName: string;
  title: string;
  description?: string;
  songIds: string[];
  isPublic: boolean;
  createdAt: any;
  updatedAt: any;
};

export type SongVersion = {
  id: string;
  sheet: SongSheet;
  title: string;
  artist: string;
  savedAt: any;
  savedBy: string;
};

export type RecentPlay = {
  songId: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  openedAt: any;
};

export type PresenceEntry = {
  userId: string;
  displayName: string;
  photoURL?: string;
  joinedAt: any;
  lastSeen: any;
};

export type Reaction = {
  id: string;
  emoji: '👏' | '🔥' | '❤️';
  userId: string;
  createdAt: any;
};
