'use client';

import type { SongSheet } from './types';

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
 * Transposes a full chord string (e.g., "Am7/G", "G-Dur") by replacing its root and bass notes.
 * @param chord The chord string to transpose.
 * @param amount The number of semitones to shift.
 * @returns The transposed chord string.
 */
export const transposeChord = (chord: string, amount: number): string => {
    if (!chord || !chord.trim()) {
        return chord;
    }
    // This regex captures the root note (A-G with optional # or b)
    // and the rest of the chord string, including a potential bass note.
    const match = chord.match(/^([A-G][#b]?)(.*)/);

    if (!match) {
        // Not a chord or a format we recognize, return it as is.
        return chord;
    }

    const note = match[1];
    const rest = match[2];

    const transposedNote = transposeNote(note, amount);

    // Now, handle the bass note if it exists (e.g., in "Am/G")
    const parts = rest.split('/');
    if (parts.length > 1) {
        const quality = parts[0];
        const bassNote = parts[1];
        const transposedBass = transposeNote(bassNote, amount);
        return transposedNote + quality + '/' + transposedBass;
    }

    return transposedNote + rest;
};


/**
 * Transposes the chords and the key within a structured song sheet.
 * @param sheet The song sheet object.
 * @param amount The number of semitones to shift.
 * @returns A new song sheet object with transposed chords and key.
 */
export const transposeSongSheet = (sheet: SongSheet, amount: number): SongSheet => {
    if (amount === 0) return sheet;

    const newSongParts = sheet.song.map(part => {
        const newLines = part.lines.map(line => {
            if (!line.chords) {
                return line;
            }
            // Apply transposeChord to each chord in the chords string, preserving whitespace
            const transposedChords = line.chords
                .split(/(\s+)/) // Split by whitespace but keep the delimiter
                .map(token => {
                    // If the token is just whitespace, return it as is
                    if (!token.trim()) return token;
                    // Otherwise, it's a chord, so transpose it
                    return transposeChord(token, amount);
                })
                .join('');
            return { ...line, chords: transposedChords };
        });
        return { ...part, lines: newLines };
    });

    const transposedKey = transposeNote(sheet.key, amount);

    return { ...sheet, key: transposedKey, song: newSongParts };
};
