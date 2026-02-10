import { NextResponse } from 'next/server';

// This route acts as a proxy to the Songsterr API to avoid CORS issues.
export async function GET(
  request: Request,
  { params }: { params: { slug: string[] } }
) {
  const slug = params.slug.join('/');
  const { searchParams } = new URL(request.url);

  // Reconstruct the Songsterr API URL
  const songsterrUrl = `https://www.songsterr.com/a/ra/${slug}?${searchParams.toString()}`;

  try {
    const response = await fetch(songsterrUrl, {
      // Add more browser-like headers to avoid being blocked
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.songsterr.com/',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Songsterr API error for ${songsterrUrl}:`, response.status, errorBody);
      // Forward the status and message from Songsterr
      return new NextResponse(errorBody, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`Internal proxy error for ${songsterrUrl}:`, error);
    return new NextResponse('Error proxying to Songsterr API: ' + error.message, { status: 500 });
  }
}
