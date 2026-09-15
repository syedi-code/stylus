/**
 * The essay token grammar, bound to the live param vocabulary.
 *
 * Two halves with opposite natures meet here. The machinery — regex, parse,
 * validate, serialise — is shipped code, because it runs on every keystroke
 * for live preview. The vocabulary it validates against is data, and comes
 * from alexandria in the /session payload. See essayTokenGrammar.ts and
 * contract.ts respectively; this module is only the join.
 *
 * Everything in the app imports from here, never from either half directly.
 */
import {
	parseEssayToken as parseWithSpecs,
	serializeToken as serializeWithSpecs,
} from './essayTokenGrammar';
import { EMBED_PARAM_SPECS } from './contract';

export type {
	EmbedKind,
	EmbedParams,
	EmbedParamSpecs,
	ParamSpec,
	ParamValue,
	ParsedToken,
} from './essayTokenGrammar';

import type { ParsedToken } from './essayTokenGrammar';

export function parseEssayToken(paragraph: string): ParsedToken | null {
	return parseWithSpecs(paragraph, EMBED_PARAM_SPECS);
}

export function serializeToken(token: ParsedToken): string {
	return serializeWithSpecs(token, EMBED_PARAM_SPECS);
}
