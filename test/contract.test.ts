import { describe, it, expect } from 'vitest';
import {
	MAX_LENGTHS,
	EMBED_PARAM_SPECS,
	applyContract,
} from '../src/lib/contract';
import { EMBED_PARAM_SPECS as SHIPPED } from '../src/lib/essayTokenGrammar';
import { parseEssayToken, serializeToken } from '../src/lib/essayTokens';

const ID = '9f2a1b3c-4d5e-4f60-8a71-b2c3d4e5f607';

describe('before the server answers', () => {
	it('falls back to the vocabulary shipped with the grammar', () => {
		expect(JSON.parse(JSON.stringify(EMBED_PARAM_SPECS))).toEqual(
			JSON.parse(JSON.stringify(SHIPPED))
		);
	});

	it('has limits to enforce', () => {
		expect(MAX_LENGTHS.ESSAY).toBeGreaterThan(0);
		expect(MAX_LENGTHS.CONTENT).toBeGreaterThan(0);
	});
});

describe('once the server answers', () => {
	it('parses a param the shipped vocabulary does not know', () => {
		expect(parseEssayToken(`[[image:${ID} bg=sepia]]`)?.params).toEqual({});

		applyContract({
			limits: { ...MAX_LENGTHS, ESSAY: 50_000 },
			embed_param_specs: {
				...EMBED_PARAM_SPECS,
				image: [
					{
						key: 'bg',
						type: 'enum',
						enumValues: ['dark', 'light', 'none', 'sepia'],
						default: 'dark',
						description: 'Slide background',
					},
				],
			},
		});

		expect(MAX_LENGTHS.ESSAY).toBe(50_000);
		expect(parseEssayToken(`[[image:${ID} bg=sepia]]`)?.params).toEqual({
			bg: 'sepia',
		});
	});

	it('round-trips a token through the live vocabulary', () => {
		const token = parseEssayToken(`[[image:${ID} bg=sepia]]`)!;
		expect(serializeToken(token)).toBe(`[[image:${ID} bg=sepia]]`);
	});
});

describe('the grammar itself', () => {
	it('clamps an int to the spec bounds', () => {
		expect(parseEssayToken(`[[quote:${ID} size=999]]`)?.params).toEqual({
			size: 48,
		});
	});

	it('drops an unknown key', () => {
		expect(parseEssayToken(`[[book:${ID} nonsense=1]]`)?.params).toEqual(
			{}
		);
	});

	it('returns null for a paragraph that is not a token', () => {
		expect(parseEssayToken('Just some prose.')).toBeNull();
	});
});
