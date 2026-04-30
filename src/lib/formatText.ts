export const escapeHtml = (text: string): string => {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
};

/**
 * Convert straight quotes to curly quotes, ASCII dashes to proper
 * em/en-dashes, triple dots to ellipsis, and add hair spaces around em-dashes.
 * Must be called on raw text BEFORE escapeHtml (these characters are not HTML-special).
 */
export const smartPunctuation = (text: string): string => {
	let result = text;

	// Em-dash: --- → — (before en-dash)
	result = result.replace(/---/g, '\u2014');
	// En-dash: -- → –
	result = result.replace(/--/g, '\u2013');
	// Ellipsis: ... → …
	result = result.replace(/\.\.\./g, '\u2026');

	// Double quotes: "..." → \u201C...\u201D
	// Opening: after start-of-string, whitespace, or opening punctuation
	result = result.replace(/(^|[\s(\[{\u2014\u2013*_])"/gm, '$1\u201C');
	// Closing: everything else
	result = result.replace(/"/g, '\u201D');

	// Single quotes / apostrophes:
	// Apostrophe in contractions (don't, it's, etc.) — must come first
	result = result.replace(/([a-zA-Z])'([a-zA-Z])/g, '$1\u2019$2');
	// Opening single quote: after start-of-string, whitespace, or opening punctuation
	result = result.replace(/(^|[\s(\[{\u2014\u2013*_])'/gm, '$1\u2018');
	// Closing single quote: everything else
	result = result.replace(/'/g, '\u2019');

	// Hair spaces around em-dashes (\u200A = hair space)
	result = result.replace(/(\S)\u2014(\S)/g, '$1\u200A\u2014\u200A$2');

	return result;
};

/**
 * Normalise for matching: lowercase + collapse whitespace runs.
 * Used to compare italicised spans against known book titles.
 */
const normaliseTitle = (s: string): string =>
	s.toLowerCase().replace(/\s+/g, ' ').trim();

export const formatMarkdown = (text: string, bookTitles?: string[]): string => {
	let result = escapeHtml(smartPunctuation(text));

	// **bold** → <strong>bold</strong> (process before single asterisks)
	result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

	// *italic* → <em>italic</em>. If the italicised text matches one of the
	// essay's referenced book titles (case-insensitive, whitespace-normalised),
	// emit it as <em class="book-ref"> so a gold underline can be applied.
	const titleSet = bookTitles?.length
		? new Set(bookTitles.map(normaliseTitle))
		: null;
	result = result.replace(/\*([^*]+)\*/g, (_match, inner: string) => {
		// Strip any HTML entities for comparison (we only escaped & < > " ').
		// For book-title matching, decoding back is unnecessary because the
		// title set was provided as raw strings and gets escaped consistently.
		const cls =
			titleSet && titleSet.has(normaliseTitle(decodeBasicEntities(inner)))
				? ' class="book-ref"'
				: '';
		return `<em${cls}>${inner}</em>`;
	});

	// `code` → <code>code</code>
	result = result.replace(
		/`([^`]+)`/g,
		'<code class="bg-mono-800 border border-mono-700 mx-0.5 px-1.5 py-0.5 rounded font-mono text-accent-bright" style="font-size: 0.875em">$1</code>'
	);

	// {name} → styled author/name span (soft gold tint)
	result = result.replace(
		/\{([^}]+)\}/g,
		'<span class="font-medium" style="color: #e8d0a8">$1</span>'
	);

	return result;
};

const decodeBasicEntities = (s: string): string =>
	s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'");
