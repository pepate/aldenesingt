import { NextResponse } from 'next/server';
import { getSession } from '@/lib/sessions';
import { songs } from '@/lib/songs';

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const song = songs.find((s) => s.id === session.songId);

    if (!song) {
      return NextResponse.json(
        { error: 'Song not found for this session' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      songId: song.id,
      songUrl: song.url,
      title: song.title,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch session data' },
      { status: 500 }
    );
  }
}
