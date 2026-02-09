'use server';
/**
 * @fileOverview An AI flow for extracting song lyrics and chords from a website URL.
 *
 * - extractSongFromUrl - A function that handles the song extraction process from a URL.
 * - ExtractSongFromUrlInput - The input type for the extractSongFromUrl function.
 * - ExtractSongOutput - The return type (shared with PDF extraction).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractSongFromUrlInputSchema = z.object({
  url: z.string().url().describe('The URL of the website containing the song lyrics and chords.'),
});
export type ExtractSongFromUrlInput = z.infer<typeof ExtractSongFromUrlInputSchema>;

// Re-using the same output schema as the PDF extraction for consistency.
const ExtractSongOutputSchema = z.object({
    title: z.string().describe('The title of the song.'),
    content: z.string().describe("The extracted lyrics and chords. Chords should be placed on their own line, directly above the corresponding lyrics line. Preserve the song's structure (verses, chorus, etc.).")
});
export type ExtractSongOutput = z.infer<typeof ExtractSongOutputSchema>;

export async function extractSongFromUrl(input: ExtractSongFromUrlInput): Promise<ExtractSongOutput> {
  return extractSongFromUrlFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractSongFromUrlPrompt',
  input: {schema: z.object({ htmlContent: z.string() })},
  output: {schema: ExtractSongOutputSchema},
  prompt: `You are an expert musician's assistant. Your task is to analyze the provided HTML content from a website and extract the song's title, lyrics, and chords.

Ignore all non-musical content like navigation menus, ads, comments, and headers/footers. Focus only on the song itself.

Format the output precisely as requested:
1.  Extract the song title. If no explicit title is found, derive a suitable one from the content.
2.  Extract all lyrics and chords.
3.  Place the chord names on their own line, directly above the line of lyrics they correspond to.
4.  Maintain the song's structure (e.g., [Verse 1], [Chorus], [Bridge]). Use common formatting like this for section headers.
5.  If a line has no chords, there should be no chord line above it.
6.  Ensure there are no empty lines between a chord line and its corresponding lyric line.

Here is the HTML content to analyze:
{{{htmlContent}}}`,
});

const extractSongFromUrlFlow = ai.defineFlow(
  {
    name: 'extractSongFromUrlFlow',
    inputSchema: ExtractSongFromUrlInputSchema,
    outputSchema: ExtractSongOutputSchema,
  },
  async ({ url }) => {
    // Fetch the HTML content from the provided URL
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    const htmlContent = await response.text();

    const {output} = await prompt({ htmlContent });
    if (!output) {
        throw new Error("Failed to extract song from URL. The model did not return any output.");
    }
    return output;
  }
);
