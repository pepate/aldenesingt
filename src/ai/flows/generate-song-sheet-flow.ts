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

Generate a detailed and accurate song sheet for the given song, adhering strictly to the JSON format provided.

Please provide the following information:
- songtitle: The official, verified title of the song.
- artist: The name of the original recording artist.
- sheet.releaseDate: The year the song was originally released.
- sheet.genre: The primary genre of the song (e.g., "Liedermacher", "Pop", "Rock").
- sheet.key: The original musical key of the song (e.g., "G-Dur", "A-Moll").
- sheet.song: An array of the song's parts. Each part must have:
  - part: The name of the section (e.g., "Strophe 1", "Refrain", "Bridge", "Gitarrensolo"). Use German terms.
  - lines: An array of lines. Each line object must contain:
    - chords: The correct chords for that line of text. The chords must be precisely aligned above the corresponding syllables of the lyrics. Use spaces to ensure perfect alignment for musicians. If a line contains no chords, this field must be an empty string.
    - text: The exact, verbatim lyrics for that line.

Analyze the following song:
Song Title: {{title}}
Artist: {{artist}}

Generate the complete and accurate song sheet. Do not improvise or add any information that is not widely recognized as part of the official song. The accuracy of the lyrics and chord placements is of utmost importance.`,
});

const generateSongSheetFlow = ai.defineFlow(
  {
    name: 'generateSongSheetFlow',
    inputSchema: GenerateSongSheetInputSchema,
    outputSchema: GenerateSongSheetOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error(
        'Failed to generate song sheet. The model did not return any output.'
      );
    }
    return output;
  }
);
