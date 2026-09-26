import { describe, it, expect } from 'vitest';
import { EssayHistory } from './essayHistory';

const e = (content: string, index = 0, caret = content.length) => ({ content, index, caret });

describe('EssayHistory', () => {
	it('undoes a structural edit whole', () => {
		const h = new EssayHistory();
		h.reset(e('One.\n\n[[quote:x]]'));
		h.record(e('One.', 0), 'edit', 1000);
		expect(h.undo()?.content).toBe('One.\n\n[[quote:x]]');
		expect(h.redo()?.content).toBe('One.');
	});

	it('folds a burst of keystrokes into one step, broken at word boundaries', () => {
		const h = new EssayHistory();
		h.reset(e(''));
		h.record(e('T'), 'typing', 0);
		h.record(e('Th'), 'typing', 100);
		h.record(e('The'), 'typing', 200);
		h.record(e('The '), 'word', 300);
		h.record(e('The c'), 'typing', 400);
		h.record(e('The ca'), 'typing', 500);
		expect(h.undo()?.content).toBe('The');
		expect(h.undo()?.content).toBe('');
		expect(h.undo()).toBeNull();
	});

	it('does not fold across a pause, or across blocks', () => {
		const h = new EssayHistory();
		h.reset(e(''));
		h.record(e('a', 0), 'typing', 0);
		h.record(e('ab', 0), 'typing', 5000);
		h.record(e('ab\n\nc', 1), 'typing', 5100);
		expect(h.undo()?.content).toBe('ab');
		expect(h.undo()?.content).toBe('a');
	});

	it('drops the redo branch when a new edit is made', () => {
		const h = new EssayHistory();
		h.reset(e('a'));
		h.record(e('b'), 'edit', 0);
		h.undo();
		h.record(e('c'), 'edit', 10);
		expect(h.canRedo).toBe(false);
		expect(h.undo()?.content).toBe('a');
	});

	it('ignores a record that changes nothing', () => {
		const h = new EssayHistory();
		h.reset(e('same'));
		h.record(e('same'), 'edit', 0);
		expect(h.canUndo).toBe(false);
	});
});
