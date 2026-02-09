import { NextResponse } from 'next/server';
import { updateSessionSong } from '@/lib/sessions';
import { songs } from '@/lib/songs';

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const { songId } = await request.json();

    if (!songId || !songs.find((s) => s.id === songId)) {
      return NextResponse.json({ error: 'Invalid song ID' }, { status: 400 });
    }

    const success = updateSessionSong(sessionId, songId);

    if (!success) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update song' },
      { status: 500 }
    );
  }
}
