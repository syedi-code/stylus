import { paletteIndexForName, sliceName } from './bookAttribution';

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
	result = result.replace(/(^|[\s(\[{<\u2014\u2013*_])"/gm, '$1\u201C');
	// Closing: everything else
	result = result.replace(/"/g, '\u201D');

	// Single quotes / apostrophes:
	// Apostrophe in contractions (don't, it's, etc.) — must come first
	result = result.replace(/([a-zA-Z])'([a-zA-Z])/g, '$1\u2019$2');
	// Opening single quote: after start-of-string, whitespace, or opening punctuation
	result = result.replace(/(^|[\s(\[{<\u2014\u2013*_])'/gm, '$1\u2018');
	// Closing single quote: everything else
	result = result.replace(/'/g, '\u2019');

	// Hair spaces around em-dashes (\u200A = hair space)
	result = result.replace(/(\S)\u2014(\S)/g, '$1\u200A\u2014\u200A$2');

	return result;
};

export const formatMarkdown = (text: string): string => {
	let result = escapeHtml(smartPunctuation(text));

	// **bold** → <strong>bold</strong> (process before single asterisks)
	result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

	// *italic* → <em>italic</em>
	result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');

	// <text> → gold-underlined span. Dedicated delimiter for the gold-underline
	// effect (formerly auto-applied to italics matching a referenced book title;
	// now an explicit, content-agnostic emphasis). Operates on the post-escape
	// stream where literal '<'/'>' are already &lt;/&gt;, so the only matches
	// are user-typed angular brackets.
	result = result.replace(
		/&lt;((?:(?!&lt;|&gt;)[\s\S])+?)&gt;/g,
		'<span class="gold-underline">$1</span>'
	);

	// ::Name:: → the surname in its hashed palette color, so a thinker named
	// mid-sentence wears the same color as the citation row under the quote they
	// came from. Only the surname takes the color — first names and suffixes
	// stay in the surrounding text color — which is exactly how BookAttribution
	// renders a structured author field, and is why the span is sliced rather
	// than colored whole. `sliceName` also means ::King::, ::Martin Luther King::
	// and a book's "Martin Luther King Jr." all land on one slot — it is the
	// surname token that converges, so an initialism (::MLK::) is a different
	// person to the hash, and would need an alias table to read otherwise.
	//
	// Placed ahead of the `code` rule so it can never match a colon inside an
	// emitted class or style attribute, and its own output carries no doubled
	// colon, so it cannot re-match itself.
	result = result.replace(/::([^:]+)::/g, (whole, inner: string) => {
		const { firstParts, lastName, suffix } = sliceName(inner);
		const slot = paletteIndexForName(lastName);
		// Nothing hashable inside the marker — leave the source text visible
		// rather than silently swallowing it.
		if (slot < 0) return whole;
		return `${firstParts}<span class="author-hl author-c${slot}">${lastName}</span>${suffix}`;
	});

	// `code` → <code>code</code>
	result = result.replace(
		/`([^`]+)`/g,
		'<code class="bg-mono-800 border border-mono-700 mx-0.5 px-1.5 py-0.5 rounded font-mono text-accent-bright" style="font-size: 0.875em">$1</code>'
	);

	// {name} → highlight. A class (not an inline style) so context can restyle
	// it — on a gold foil the default gold tint would be gold-on-gold, so the
	// `.foil-text .md-hl` override turns it into a dark chip. Keep the run at the
	// surrounding font-weight so it stays in the same Tiempos cut as neighbors.
	result = result.replace(/\{([^}]+)\}/g, '<span class="md-hl">$1</span>');

	return result;
};
