'use server';
/**
 * @fileOverview An AI flow for generating a structured song sheet from a title and artist.
 *
 * - generateSongSheet - A function that handles the song sheet generation process.
 * - GenerateSongSheetInput - The input type for the generateSongSheet function.
 * - GenerateSongSheetOutput - The return type for the generateSongSheet function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateSongSheetInputSchema = z.object({
  title: z.string().describe('The title of the song.'),
  artist: z.string().describe('The artist of the song.'),
  lyrics: z
    .string()
    .describe(
      'The verified lyrics of the song. The AI must use these lyrics exactly.'
    ),
});
export type GenerateSongSheetInput = z.infer<
  typeof GenerateSongSheetInputSchema
>;

const LineSchema = z.object({
  chords: z.string().describe('The chord progression for the line of text.'),
  text: z.string().describe('The lyrics for the line.'),
});

const PartSchema = z.object({
  part: z
    .string()
    .describe('The name of the song part (e.g., "Verse 1", "Refrain").'),
  lines: z.array(LineSchema),
});

const SongSheetSchema = z.object({
  releaseDate: z.string().describe('The release year of the song.'),
  genre: z.string().describe('The genre of the song.'),
  key: z.string().describe('The original key of the song.'),
  song: z
    .array(PartSchema)
    .describe('An array of song parts (verse, chorus, etc.).'),
});

const GenerateSongSheetOutputSchema = z.object({
  songtitle: z.string().describe('The title of the song.'),
  artist: z.string().describe('The artist of the song.'),
  sheet: SongSheetSchema,
  artworkUrl: z
    .string()
    .optional()
    .describe('URL for the song/album artwork.'),
});
export type GenerateSongSheetOutput = z.infer<
  typeof GenerateSongSheetOutputSchema
>;

export async function generateSongSheet(
  input: GenerateSongSheetInput
): Promise<GenerateSongSheetOutput> {
  return generateSongSheetFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSongSheetPrompt',
  input: { schema: GenerateSongSheetInputSchema },
  output: { schema: GenerateSongSheetOutputSchema },
  prompt: `You are a meticulous and highly accurate music archivist. Your primary goal is to create a factually correct and precise song sheet. It is critical that you do not invent, guess, or hallucinate any lyrics or chords. Your reputation depends on your accuracy.

CRITICAL INSTRUCTION FOR CHORD PLACEMENT:
The 'chords' string must be perfectly aligned with the 'text' string. Use spaces to position the chord directly above the corresponding syllable or word. If a line has no chords, the 'chords' field must be an empty string. The 'chords' and 'text' strings for a single line do NOT need to have the same length. Focus on correct placement over equal length.

For example:
GOOD:
"chords": "G           C        G",
"text":   "Über den Wolken"

BAD (misaligned):
"chords": "G C G",
"text":   "Über den Wolken"

The exact lyrics for the song are provided below. Your task is to:
1.  Use the provided lyrics VERBATIM. Do not change, add, or remove a single word. Structure them into parts (verse, chorus, etc.) as appropriate.
2.  Add the correct chords for each line of text, following the CRITICAL INSTRUCTION FOR CHORD PLACEMENT above.
3.  Fill out the other metadata fields (releaseDate, genre, key) with accurate information based on the song. It is crucial that you correctly identify the song's original key.

Song Title: {{title}}
Artist: {{artist}}

Provided Lyrics:
---
{{{lyrics}}}
---
`,
});

const generateSongSheetFlow = ai.defineFlow(
  {
    name: 'generateSongSheetFlow',
    inputSchema: GenerateSongSheetInputSchema,
    outputSchema: GenerateSongSheetOutputSchema,
  },
  async (input) => {
    // 1. Get song sheet from Gemini, using the provided lyrics
    const { output } = await prompt(input);

    if (!output) {
      throw new Error(
        'Failed to generate song sheet. The model did not return any output.'
      );
    }

    // 2. Fetch artwork from iTunes
    let artworkUrl: string | undefined = undefined;
    try {
      const searchTerm = encodeURIComponent(`${input.artist} ${input.title}`);
      const itunesResponse = await fetch(
        `https://itunes.apple.com/search?term=${searchTerm}&entity=song&limit=1`
      );
      if (itunesResponse.ok) {
        const itunesData = await itunesResponse.json();
        if (
          itunesData.resultCount > 0 &&
          itunesData.results[0].artworkUrl100
        ) {
          artworkUrl = itunesData.results[0].artworkUrl100.replace(
            '100x100',
            '400x400'
          ); // Get a larger image
        }
      }
    } catch (e) {
      console.error('Could not fetch artwork from iTunes', e);
      // Do not throw an error, artwork is optional
    }

    return {
      songtitle: output.songtitle,
      artist: output.artist,
      sheet: output.sheet,
      artworkUrl,
    };
  }
);
