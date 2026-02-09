import { NextResponse } from 'next/server';
import { createSession } from '@/lib/sessions';
import { songs } from '@/lib/songs';

export async function POST(request: Request) {
  try {
    const { songId } = await request.json();
    if (!songId || !songs.find((s) => s.id === songId)) {
      return NextResponse.json({ error: 'Invalid song ID' }, { status: 400 });
    }

    const sessionId = createSession(songId);
    return NextResponse.json({ sessionId });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
