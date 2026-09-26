/**
 * Undo for the whole piece, not for one textarea.
 *
 * Each paragraph is its own textarea, so the browser's undo only ever knew
 * about the paragraph under the caret — and it was blank after every Enter,
 * every merge, every quote set in or deleted, because those replace the
 * textarea it was attached to. Deleting a quote by accident could not be
 * undone at all. This keeps the content string itself, which is the one
 * thing every edit passes through.
 */

/** A keystroke folds into the last entry; a word boundary or an edit does not. */
export type EditKind = 'typing' | 'word' | 'edit';

export interface HistoryEntry {
	content: string;
	/** Which block held the caret, by position — block ids do not survive a reload. */
	index: number;
	caret: number;
}

export interface HistoryOptions {
	/** Keystrokes closer together than this undo as one. */
	coalesceMs?: number;
	limit?: number;
}

export class EssayHistory {
	private stack: HistoryEntry[] = [];
	private at = -1;
	private lastPush = 0;
	private lastWasTyping = false;
	private readonly coalesceMs: number;
	private readonly limit: number;

	constructor(opts: HistoryOptions = {}) {
		this.coalesceMs = opts.coalesceMs ?? 1200;
		this.limit = opts.limit ?? 300;
	}

	reset(entry: HistoryEntry) {
		this.stack = [entry];
		this.at = 0;
		this.lastWasTyping = false;
	}

	/**
	 * Record the state after a change. Typing into the same block in quick
	 * succession folds into one entry; the caller breaks the fold at a word
	 * boundary, so an undo takes back a phrase rather than the whole paragraph.
	 */
	record(entry: HistoryEntry, kind: EditKind, now = Date.now()) {
		const typing = kind !== 'edit';
		const top = this.stack[this.at];
		if (top && top.content === entry.content) {
			top.index = entry.index;
			top.caret = entry.caret;
			return;
		}
		const fold =
			typing &&
			this.lastWasTyping &&
			top !== undefined &&
			top.index === entry.index &&
			now - this.lastPush < this.coalesceMs &&
			this.at > 0 &&
			kind === 'typing';
		this.stack.length = this.at + 1;
		if (fold) this.stack[this.at] = entry;
		else {
			this.stack.push(entry);
			this.at += 1;
			if (this.stack.length > this.limit) {
				this.stack.shift();
				this.at -= 1;
			}
		}
		this.lastPush = now;
		this.lastWasTyping = typing;
	}

	/**
	 * Undo lands on the state BEFORE the change, but with the caret where the
	 * change happened — which is where the eye already is.
	 */
	undo(): HistoryEntry | null {
		if (this.at <= 0) return null;
		const undone = this.stack[this.at];
		this.at -= 1;
		this.lastWasTyping = false;
		const prev = this.stack[this.at];
		return { ...prev, index: undone.index, caret: Math.min(undone.caret, prev.caret) };
	}

	redo(): HistoryEntry | null {
		if (this.at >= this.stack.length - 1) return null;
		this.at += 1;
		this.lastWasTyping = false;
		return { ...this.stack[this.at] };
	}

	get canUndo() {
		return this.at > 0;
	}
	get canRedo() {
		return this.at < this.stack.length - 1;
	}
}
