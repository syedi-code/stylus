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
import {
	EMBED_PARAM_SPECS as GRAMMAR_DEFAULT_SPECS,
	type EmbedParamSpecs,
} from './essayTokenGrammar';

export type { EmbedParamSpecs };

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

/** Mutated in place on arrival so templates reading it re-render. */
export const MAX_LENGTHS = reactive({ ...FALLBACK_LIMITS });

export const EMBED_PARAM_SPECS = reactive({
	...GRAMMAR_DEFAULT_SPECS,
}) as EmbedParamSpecs;

export function applyContract(contract: ApiContract | undefined): void {
	if (!contract) return;
	Object.assign(MAX_LENGTHS, contract.limits);
	Object.assign(EMBED_PARAM_SPECS, contract.embed_param_specs);
}
