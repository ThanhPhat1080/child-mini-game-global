/** One picture the Super Admin allows in Puzzle Pairs (spec A32). */
export type PuzzlePicture = { id: string; word: string; image_path: string; audio_path: string | null };
/** Left or right half of a picture. */
export type Side = 'L' | 'R';
/** A point on the 1920 x 1080 stage. */
export type Pt = { x: number; y: number };
