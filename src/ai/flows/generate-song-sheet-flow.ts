'use server';
/**
 * @fileOverview A flow to generate a song sheet with chords using AI.
 */
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Zod schemas mirroring the types in src/lib/types.ts
const SongLineSchema = z.object({
  chords: z
    .string()
    .describe(
      'The chord progressions for the line of text. Chords should be placed above the corresponding syllables. Preserve spacing.'
    ),
  text: z.string().describe('A single line of lyric text.'),
});

const SongPartSchema = z.object({
  part: z
    .string()
    .describe(
      'The name of the song part (e.g., "Verse 1", "Chorus", "Bridge").'
    ),
  lines: z
    .array(SongLineSchema)
    .describe('An array of lines within this part of the song.'),
});

const SongSheetSchema = z.object({
  releaseDate: z.string().describe("The song's release date or year.").optional(),
  genre: z.string().describe("The genre of the song.").optional(),
  key: z.string().describe('The musical key of the song.'),
  song: z
    .array(SongPartSchema)
    .describe('The structured song with all its parts.'),
});

const GenerateSongSheetInputSchema = z.object({
  artist: z.string(),
  title: z.string(),
  lyrics: z.string().describe('The full lyrics for the song.'),
  key: z
    .string()
    .describe('The desired musical key for the chord generation.'),
});

export type GenerateSongSheetInput = z.infer<
  typeof GenerateSongSheetInputSchema
>;
export type GenerateSongSheetOutput = z.infer<typeof SongSheetSchema>;


export async function generateSongSheet(
  input: GenerateSongSheetInput
): Promise<GenerateSongSheetOutput> {
  const flow = ai.defineFlow(
    {
      name: 'generateSongSheetFlow',
      inputSchema: GenerateSongSheetInputSchema,
      outputSchema: SongSheetSchema,
    },
    async (input) => {
      const prompt = `You are an expert musician and guitarist. Your task is to generate a complete and accurate song sheet for the provided lyrics.

      Instructions:
      1.  Analyze the provided lyrics for the song "${input.title}" by ${input.artist}.
      2.  Generate the appropriate chords for the song in the specified key of **${input.key}**.
      3.  Structure the output into logical parts (Verse, Chorus, Bridge, etc.).
      4.  For each line of lyrics, provide a corresponding line of chords. The chords should be placed precisely above the syllables where they change. Maintain spacing for correct alignment.
      5.  Return the final song sheet as a JSON object that conforms to the specified output schema. Do not include any other text or explanations in your response.
      
      Lyrics:
      ---
      ${input.lyrics}
      ---
      `;

      const llmResponse = await ai.generate({
        prompt: prompt,
        model: 'googleai/gemini-2.5-flash',
        output: {
          format: 'json',
          schema: SongSheetSchema,
        },
        config: {
          temperature: 0.3,
        }
      });
      
      const output = llmResponse.output;
      if (!output) {
        throw new Error('AI did not return valid song sheet data.');
      }
      return output;
    }
  );

  return await flow(input);
}
