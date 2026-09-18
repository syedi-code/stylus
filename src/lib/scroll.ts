/**
 * Run a list reload without losing your place. Saving an edit re-sorts the
 * list, which moves the scroll position out from under you.
 */
export async function keepingScroll(reload: () => Promise<unknown>): Promise<void> {
	const scrollY = window.scrollY;
	await reload();
	requestAnimationFrame(() => window.scrollTo(0, scrollY));
}
