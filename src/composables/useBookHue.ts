/**
 * Deterministic book color hue generation.
 * Produces consistent HSL colors from book IDs for gradient bars and reference dots.
 */

/** Simple string hash → number (djb2 algorithm) */
function hashString(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash * 33) ^ str.charCodeAt(i);
	}
	return hash >>> 0; // ensure positive
}

/**
 * Get a deterministic HSL color string for a book ID.
 * Returns a CSS HSL value like "hsl(204, 65%, 65%)".
 */
export function bookHue(bookId: string): string {
	const hue = hashString(bookId) % 360;
	return `hsl(${hue}, 65%, 65%)`;
}

/**
 * Get a CSS linear-gradient string blending the hues of multiple books.
 * Falls back to neutral grey gradient when no books are provided.
 */
export function bookGradient(bookIds: string[]): string {
	if (bookIds.length === 0) {
		return 'linear-gradient(90deg, #3f3f46, #27272a)';
	}
	if (bookIds.length === 1) {
		const color = bookHue(bookIds[0]);
		return `linear-gradient(90deg, ${color}, ${color})`;
	}
	const colors = bookIds.map((id) => bookHue(id));
	return `linear-gradient(90deg, ${colors.join(', ')})`;
}
