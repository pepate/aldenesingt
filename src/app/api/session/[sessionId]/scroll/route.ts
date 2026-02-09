import { NextResponse } from 'next/server';
import { getScrollPosition, setScrollPosition } from '@/lib/sessions';

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const scroll = getScrollPosition(sessionId);

    if (scroll === undefined) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ scroll });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get scroll position' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const { scroll } = await request.json();

    if (typeof scroll !== 'number') {
      return NextResponse.json({ error: 'Invalid scroll value' }, { status: 400 });
    }

    const success = setScrollPosition(sessionId, scroll);
    if (!success) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to set scroll position' },
      { status: 500 }
    );
  }
}
