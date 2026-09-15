/**
 * The server's answer to "how long may this field be, and which parameters
 * may this embed carry".
 *
 * Both are data, so alexandria owns them and sends them on POST /session.
 * The values below are a fallback for the frames before that response lands
 * — never the source of truth. Adding a param or raising a limit is a server
 * change; this file does not need to follow.
 *
 * The parsing machinery is the other half and works the other way round: it
 * runs on every keystroke, so it is shipped code rather than fetched data.
 * Plan D20.
 */
import { reactive } from 'vue';
import type { EmbedKind, ParamSpec } from './essayTokens';

export type EmbedParamSpecs = Record<EmbedKind, readonly ParamSpec[]>;

export interface ApiContract {
	limits: Record<string, number>;
	embed_param_specs: EmbedParamSpecs;
}

const FALLBACK_LIMITS = {
	CONTENT: 3_000,
	ESSAY: 20_000,
	TITLE: 500,
	SHORT: 200,
	ID: 100,
	URL: 2_000,
	TAGS: 1_000,
};

const FALLBACK_EMBED_PARAM_SPECS: EmbedParamSpecs = {
	quote: [
		{
			key: 'size',
			type: 'int',
			min: 12,
			max: 48,
			default: 24,
			description: 'Font size in pixels (12–48)',
		},
	],
	book: [
		{
			key: 'author',
			type: 'enum',
			enumValues: ['show', 'hide'],
			default: 'hide',
			description: 'Show author above title (defaults to hidden)',
		},
		{
			key: 'size',
			type: 'int',
			min: 12,
			max: 64,
			default: 26,
			description: 'Title font size in pixels (12–64)',
		},
	],
	image: [
		{
			key: 'bg',
			type: 'enum',
			enumValues: ['dark', 'light', 'none'],
			default: 'dark',
			description: 'Slide background (dark · light · none)',
		},
		{
			key: 'caption',
			type: 'string',
			default: '',
			description: 'Per-embed caption (overrides the image record)',
		},
	],
};

/** Mutated in place on arrival so templates reading it re-render. */
export const MAX_LENGTHS = reactive({ ...FALLBACK_LIMITS });

export const EMBED_PARAM_SPECS = reactive({
	...FALLBACK_EMBED_PARAM_SPECS,
}) as EmbedParamSpecs;

export function applyContract(contract: ApiContract | undefined): void {
	if (!contract) return;
	Object.assign(MAX_LENGTHS, contract.limits);
	Object.assign(EMBED_PARAM_SPECS, contract.embed_param_specs);
}
