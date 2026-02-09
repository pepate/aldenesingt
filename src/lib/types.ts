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
};
