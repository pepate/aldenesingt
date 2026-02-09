'use client';

const notesSharp = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
const notesFlat = ['A', 'Bb', 'B', 'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab'];

/**
 * Finds the index of a note in the chromatic scale.
 * @param note The note to find (e.g., "C#", "Bb").
 * @returns The index of the note (0-11) or -1 if not found.
 */
const getNoteIndex = (note: string): number => {
    let index = notesSharp.indexOf(note);
    if (index === -1) {
        index = notesFlat.indexOf(note);
    }
    return index;
};

/**
 * Transposes a single musical note by a given number of semitones.
 * @param note The note to transpose.
 * @param amount The number of semitones to shift (can be positive or negative).
 * @returns The transposed note.
 */
const transposeNote = (note: string, amount: number): string => {
    const index = getNoteIndex(note);
    if (index === -1) return note; // Not a transposable note

    const newIndex = (index + amount + 12) % 12;
    // Prefer sharp notation for simplicity, as it's more common for display.
    return notesSharp[newIndex];
};

/**
 * Transposes a full chord string (e.g., "Am7/G") by replacing its root and bass notes.
 * @param chord The chord string to transpose.
 * @param amount The number of semitones to shift.
 * @returns The transposed chord string.
 */
export const transposeChord = (chord: string, amount: number): string => {
    // This regex finds all valid note names (A-G with optional # or b) in a chord string.
    return chord.replace(/[A-G](?:#|b)?/g, (match) => transposeNote(match, amount));
};

/**
 * Transposes the chords within a block of text containing lyrics and chords.
 * @param content The full song content.
 * @param amount The number of semitones to shift.
 * @returns The content with transposed chords.
 */
export const transposeContent = (content: string, amount: number): string => {
    if (amount === 0) return content;

    const lines = content.split('\n');
    const transposedLines = [];

    for (const line of lines) {
        const trimmedLine = line.trim();

        if (trimmedLine.length === 0) {
            transposedLines.push(line);
            continue;
        }

        // Heuristic to identify a chord line:
        // 1. It's not a section header like [Verse].
        // 2. All space-separated parts look like valid chords.
        const isSectionHeader = /\[.*\]/.test(trimmedLine);
        const tokens = trimmedLine.split(/\s+/).filter(Boolean);
        
        // A token is considered a chord if it starts with a valid note name.
        // This is a robust way to handle various chord notations (m7, sus4, aug, etc.).
        const allTokensAreChords = tokens.every(token => 
            /^[A-G](b|#)?.*$/.test(token)
        );

        if (!isSectionHeader && allTokensAreChords) {
            const originalSpaces = line.match(/\s+/g) || [];
            let resultLine = '';
            const transposedTokens = tokens.map(token => transposeChord(token, amount));

            // Reconstruct the line preserving original spacing
            for (let i = 0; i < transposedTokens.length; i++) {
                resultLine += transposedTokens[i];
                if (originalSpaces[i]) {
                    resultLine += originalSpaces[i];
                }
            }
            
            // This logic is tricky, a simpler join is often sufficient
            // if we assume single spaces. Let's simplify.
            transposedLines.push(tokens.map(chord => transposeChord(chord, amount)).join(' '));

        } else {
            // This is likely a lyric line or section header, so keep it as is.
            transposedLines.push(line);
        }
    }

    return transposedLines.join('\n');
};
