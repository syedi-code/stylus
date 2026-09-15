/**
 * The essay token grammar, bound to the live param vocabulary.
 *
 * The machinery — regex, parse, validate, serialise — is shipped code: it runs
 * on every keystroke for live preview, so it cannot be a network call. The
 * vocabulary it validates against is data and comes from the server (see
 * contract.ts). This module is the join, and it is the only place in the app
 * that reaches into @antisocial/core.
 *
 * When stylus leaves this repo, the core functions below get copied in here
 * and the import disappears. Nothing else has to change. Plan D20.
 */
import {
	parseEssayToken as parseWithSpecs,
	serializeToken as serializeWithSpecs,
} from '@antisocial/core';
import { EMBED_PARAM_SPECS } from './contract';

export type {
	EmbedKind,
	EmbedParams,
	ParamSpec,
	ParamValue,
	ParsedToken,
} from '@antisocial/core';

import type { ParsedToken } from '@antisocial/core';

export function parseEssayToken(paragraph: string): ParsedToken | null {
	return parseWithSpecs(paragraph, EMBED_PARAM_SPECS);
}

export function serializeToken(token: ParsedToken): string {
	return serializeWithSpecs(token, EMBED_PARAM_SPECS);
}
