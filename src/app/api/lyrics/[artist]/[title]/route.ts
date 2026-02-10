import { NextResponse } from 'next/server';

// This route acts as a proxy to the lyrics.ovh API to avoid CORS issues.
export async function GET(
  request: Request,
  { params }: { params: { artist: string; title: string } }
) {
  const { artist, title } = params;
  
  if (!artist || !title) {
    return new NextResponse('Artist and title are required', { status: 400 });
  }

  // Reconstruct the lyrics.ovh API URL
  const lyricsUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;

  try {
    const response = await fetch(lyricsUrl);

    // lyrics.ovh returns 404 with a JSON error body, which is fine.
    // We only need to handle actual server errors (5xx).
    if (response.status >= 500) {
      const errorBody = await response.text();
      console.error(`lyrics.ovh API error for ${lyricsUrl}:`, response.status, errorBody);
      return new NextResponse(errorBody, { status: response.status });
    }

    const data = await response.json();
    
    // The API might return an empty lyrics string, so we'll forward it as is.
    // If lyrics are not found, it returns { "error": "No lyrics found" }.
    return NextResponse.json(data);

  } catch (error: any) {
    console.error(`Internal proxy error for ${lyricsUrl}:`, error);
    return new NextResponse('Error proxying to lyrics.ovh API: ' + error.message, { status: 500 });
  }
}
