import { describe, it, expect } from 'vitest';
import { apiContract } from '@antisocial/core';
import {
	MAX_LENGTHS,
	EMBED_PARAM_SPECS,
	applyContract,
} from '../src/lib/contract';

/**
 * The values in contract.ts are a fallback for the frames before the server
 * responds. They are allowed to be stale after stylus leaves this repo; while
 * both still live here, a drift is a mistake, so it fails loudly.
 */
describe('the shipped fallback', () => {
	const server = apiContract();

	it('matches the limits the server sends', () => {
		expect({ ...MAX_LENGTHS }).toEqual(server.limits);
	});

	it('matches the embed param vocabulary the server sends', () => {
		expect(JSON.parse(JSON.stringify(EMBED_PARAM_SPECS))).toEqual(
			JSON.parse(JSON.stringify(server.embed_param_specs))
		);
	});
});

describe('applyContract', () => {
	it('takes the server value over the fallback', () => {
		applyContract({
			limits: { ...server_limits(), ESSAY: 50_000 },
			embed_param_specs: {
				...apiContract().embed_param_specs,
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
		expect(EMBED_PARAM_SPECS.image[0].enumValues).toContain('sepia');

		applyContract(apiContract());
		expect(MAX_LENGTHS.ESSAY).toBe(20_000);
		expect(EMBED_PARAM_SPECS.image[0].enumValues).not.toContain('sepia');
	});

	it('leaves the fallback alone when the server sends nothing', () => {
		applyContract(undefined);
		expect(MAX_LENGTHS.ESSAY).toBe(20_000);
	});
});

function server_limits() {
	return apiContract().limits;
}
