'use server';
/**
 * @fileOverview An AI flow for extracting song lyrics and chords from a document.
 *
 * - extractSongFromPdf - A function that handles the song extraction process.
 * - ExtractSongInput - The input type for the extractSongFromPdf function.
 * - ExtractSongOutput - The return type for the extractSongFromPdf function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractSongInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF document of a song, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type ExtractSongInput = z.infer<typeof ExtractSongInputSchema>;

const ExtractSongOutputSchema = z.object({
    title: z.string().describe('The title of the song.'),
    content: z.string().describe("The extracted lyrics and chords. Chords should be placed on their own line, directly above the corresponding lyrics line. Preserve the song's structure (verses, chorus, etc.).")
});
export type ExtractSongOutput = z.infer<typeof ExtractSongOutputSchema>;

export async function extractSongFromPdf(input: ExtractSongInput): Promise<ExtractSongOutput> {
  return extractSongFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractSongPrompt',
  input: {schema: ExtractSongInputSchema},
  output: {schema: ExtractSongOutputSchema},
  prompt: `You are an expert musician's assistant. Your task is to analyze the provided music sheet and extract the song's title, lyrics, and chords.

Format the output precisely as requested:
1.  Extract the song title. If no explicit title is found, derive a suitable one from the first line of the lyrics.
2.  Extract all lyrics and chords.
3.  Place the chord names on their own line, directly above the line of lyrics they correspond to.
4.  Maintain the song's structure (e.g., [Verse 1], [Chorus], [Bridge]). Use common formatting like this for section headers.
5.  If a line has no chords, there should be no chord line above it.
6.  Ensure there are no empty lines between a chord line and its corresponding lyric line.

Here is the document to analyze:
{{media url=pdfDataUri}}`,
});

const extractSongFlow = ai.defineFlow(
  {
    name: 'extractSongFlow',
    inputSchema: ExtractSongInputSchema,
    outputSchema: ExtractSongOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
        throw new Error("Failed to extract song from PDF. The model did not return any output.");
    }
    return output;
  }
);
