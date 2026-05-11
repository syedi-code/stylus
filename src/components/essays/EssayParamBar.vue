<script setup lang="ts">
import { computed } from 'vue';
import {
    EMBED_PARAM_SPECS,
    parseEssayToken,
    serializeToken,
    type EmbedKind,
    type ParamSpec,
} from '@antisocial/core';
import type { EditorTokenContext } from '../../composables/useEditorTokenContext';

/**
 * Context-aware embed parameter strip. Surfaces a chip per param available
 * for the embed kind under the caret; tapping a chip mutates the token
 * (parse → update → serialize) and emits the new line for the editor to
 * splice in. Reads the param vocabulary from EMBED_PARAM_SPECS so adding a
 * new spec entry surfaces a new chip with zero UI code changes.
 */
const props = defineProps<{
    context: EditorTokenContext;
    keyboardOffset: number;
}>();

const emit = defineEmits<{
    /** Replace the token line at `range` with `next`, then optionally select
     *  the substring `[selStart, selEnd]` within the new value for typeover. */
    (
        e: 'replace',
        payload: {
            range: [number, number];
            next: string;
            selection?: [number, number];
        }
    ): void;
}>();

const specs = computed<readonly ParamSpec[]>(
    () => EMBED_PARAM_SPECS[props.context.kind as EmbedKind]
);

const label = computed(() => `${props.context.kind} params`);

const parsed = computed(() => parseEssayToken(props.context.text));

function currentValue(key: string): string | number | undefined {
    return parsed.value?.params[key];
}

/**
 * Mutate the token by setting `key` to `nextValue` and emit a replacement.
 * If `selectValue` is true, the bar will request a typeover-friendly
 * selection range around the inserted value.
 */
function applyParam(spec: ParamSpec, nextValue: string | number, selectValue = false) {
    const p = parsed.value;
    if (!p) return;
    const nextParams = { ...p.params, [spec.key]: nextValue };
    const nextToken = serializeToken({ ...p, params: nextParams });
    const [start, end] = props.context.range;

    let selection: [number, number] | undefined;
    if (selectValue) {
        const valStr = typeof nextValue === 'string' ? nextValue : String(nextValue);
        // Find the value substring in the serialized token; for strings the
        // value is surrounded by quotes — caret should land between them.
        if (typeof nextValue === 'string') {
            const needle = `${spec.key}="${valStr.replace(/"/g, '\\"')}"`;
            const idx = nextToken.indexOf(needle);
            if (idx !== -1) {
                const valStart = idx + spec.key.length + 2; // skip 'key="'
                selection = [start + valStart, start + valStart + valStr.length];
            }
        } else {
            const needle = `${spec.key}=${valStr}`;
            const idx = nextToken.indexOf(needle);
            if (idx !== -1) {
                const valStart = idx + spec.key.length + 1;
                selection = [start + valStart, start + valStart + valStr.length];
            }
        }
    }

    emit('replace', {
        range: [start, end],
        next: nextToken,
        selection,
    });
}

function handleChip(spec: ParamSpec) {
    const current = currentValue(spec.key);
    if (spec.type === 'int') {
        const next = current === undefined ? spec.default ?? spec.min ?? 0 : current;
        applyParam(spec, typeof next === 'number' ? next : Number(next), true);
    } else if (spec.type === 'enum' && spec.enumValues) {
        // Cycle through enum values on repeated taps. If unset, start at default.
        const vals = spec.enumValues;
        if (current === undefined) {
            applyParam(spec, (spec.default as string) ?? vals[0]);
        } else {
            const idx = vals.indexOf(String(current));
            const next = vals[(idx + 1) % vals.length];
            applyParam(spec, next);
        }
    } else if (spec.type === 'string') {
        const next = current === undefined ? (spec.default as string) ?? '' : String(current);
        applyParam(spec, next, true);
    }
}

function chipDisplay(spec: ParamSpec): string {
    const v = currentValue(spec.key);
    if (v === undefined) return `${spec.key}=`;
    if (spec.type === 'string') {
        const s = String(v);
        if (s === '') return `${spec.key}=""`;
        const trimmed = s.length > 16 ? `${s.slice(0, 14)}…` : s;
        return `${spec.key}="${trimmed}"`;
    }
    return `${spec.key}=${v}`;
}

const pinStyle = computed(() => {
    if (props.keyboardOffset > 0) {
        return {
            position: 'fixed' as const,
            left: '0',
            right: '0',
            bottom: `${props.keyboardOffset}px`,
            zIndex: 60,
        };
    }
    return {};
});
</script>

<template>
    <div
        v-if="specs.length > 0"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-mono-800/95 backdrop-blur border-t border-mono-700 overflow-x-auto"
        :style="pinStyle"
    >
        <span class="font-mono text-[10px] uppercase tracking-[0.06em] text-mono-500 shrink-0 mr-1">
            {{ label }}
        </span>
        <button
            v-for="spec in specs"
            :key="spec.key"
            type="button"
            @mousedown.prevent
            @click="handleChip(spec)"
            :title="spec.description"
            class="flex items-center gap-1 px-2 py-1 bg-mono-700 hover:bg-mono-600 border border-mono-600 hover:border-mono-500 rounded font-mono text-[11px] text-mono-100 cursor-pointer transition-colors shrink-0"
            :class="currentValue(spec.key) !== undefined ? 'text-essay border-essay/40' : ''"
        >
            {{ chipDisplay(spec) }}
            <span class="text-mono-500 text-[10px]" aria-hidden="true">ⓘ</span>
        </button>
    </div>
</template>
