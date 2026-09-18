<script setup lang="ts">
import { computed } from 'vue';
import { parseAuthors, type ParsedAuthor } from '../../lib/bookAttribution';

// Possessive ending. When the trailing token (suffix if present, else
// surname) ends in 's', we drop the second 's' per classical convention:
// "Descartes' Regulae", not "Descartes's Regulae". Operates on the actual
// trailing word so "Martin Luther King Jr." still gets "Jr.'s" cleanly.
function possessiveSuffix(a: ParsedAuthor): string {
    const trailing = a.suffix.trim() || a.lastName;
    return /s$/i.test(trailing) ? '’' : '’s';
}

// Shared book attribution renderer. Used wherever a book's author/title/year
// is shown attached to another entity (Note, Quote, Essay reference, etc.).
//
// Typography:
//   - Title: white, bold, italic Tiempos Text — mirrors EssayBookCoverSlide
//     without the amber tint.
//   - Author: full name in default text color, with the surname swapped to
//     a deterministic pastel-palette color (lib/bookAttribution).
//   - Year hangs inline to the right of the title; page drops to its own
//     line below (kept off the title row to leave room for long titles).
//
// Variants:
//   - card / presentation: vertically stacked
//   - chip: single inline baseline-aligned row (essay reference chips)
//   - note: single line possessive — "{Author}'s {Title}, p. X" + year below
//
// `dash` prepends an em-dash to the author row (quote-style attribution).
// `align="end"` produces the right-aligned quote presentation block.

type Variant = 'card' | 'presentation' | 'chip' | 'note';

const props = withDefaults(
    defineProps<{
        author: string | null | undefined;
        title: string | null | undefined;
        year?: string | number | null;
        page?: string | number | null;
        variant?: Variant;
        align?: 'start' | 'center' | 'end';
        titleHref?: string | null;
        dash?: boolean;
        /** Render the title in mono-200 instead of white — used by Quotes
         *  to demote the book title's visual weight relative to the quote body. */
        mutedTitle?: boolean;
        /** Promote title to a larger size (presentation variant only). Used
         *  by the essay book-cover slide where the title is the focal point. */
        prominent?: boolean;
        /** Absolute title font size in px. When set, overrides the bucketed
         *  prominent sizing — used by the essay token system's `size=` param. */
        titleSizePx?: number | null;
    }>(),
    {
        variant: 'card',
        align: 'start',
        year: null,
        page: null,
        titleHref: null,
        dash: false,
        mutedTitle: false,
        prominent: false,
        titleSizePx: null,
    },
);

const authors = computed(() => parseAuthors(props.author));
const isInline = computed(() => props.variant === 'chip');
const isNote = computed(() => props.variant === 'note');

const titleSize = computed(() => {
    switch (props.variant) {
        case 'presentation': {
            // Scale down so long titles don't dominate the slide. ~30 chars
            // is roughly the natural single-line cap at 17px.
            // `prominent` bumps each bucket up — used by the essay book-cover
            // slide where the title is the focal point. When `titleSizePx` is
            // set (via the essay token `size=` param), the bucketed class is
            // dropped and the size is applied via inline style instead.
            const len = props.title?.length ?? 0;
            if (props.prominent) {
                if (props.titleSizePx != null) return 'font-bold';
                if (len > 50) return 'text-[16px] sm:text-[19px] font-bold';
                if (len > 30) return 'text-[18px] sm:text-[22px] font-bold';
                return 'text-[20px] sm:text-[26px] font-bold';
            }
            if (len > 50) return 'text-[12px] sm:text-[14px]';
            if (len > 30) return 'text-[13px] sm:text-[15px]';
            return 'text-[15px] sm:text-[17px]';
        }
        case 'card':
            // Match year size — title differentiates by italic.
            return 'text-[13px]';
        case 'note':
            // Match the author/meta size — title differentiates by weight + italic, not size.
            return 'text-[12px]';
        case 'chip':
            return 'text-[12px]';
    }
    return '';
});

const metaSize = computed(() => {
    switch (props.variant) {
        case 'presentation': {
            // Scale the author row down for long names so it fits on one line
            // before wrapping — mirrors the length-bucketing used by `titleSize`.
            const len = props.author?.length ?? 0;
            if (len > 40) return 'text-[12px] sm:text-[15px]';
            if (len > 28) return 'text-[14px] sm:text-[17px]';
            return 'text-[16px] sm:text-[20px]';
        }
        case 'card':
            // Author bigger than the title — matches the presentation hierarchy.
            return 'text-[15px]';
        case 'chip':
        case 'note':
            return 'text-[12px]';
    }
    return '';
});

// Year sits next to the title sized 1px smaller than the title — quietly
// secondary, but still on the same line.
const yearSize = computed(() => {
    switch (props.variant) {
        case 'presentation':
            // Match title size — title differentiates by italic.
            return 'text-[15px] sm:text-[17px]';
        case 'card':
            // Match title size.
            return 'text-[13px]';
        case 'chip':
            return 'text-[11px]';
        case 'note':
            // Year sits a touch smaller than the citation row.
            return 'text-[10.5px]';
    }
    return '';
});

const alignClass = computed(() =>
    props.align === 'end'
        ? 'items-end text-right'
        : props.align === 'center'
            ? 'items-center text-center'
            : 'items-start text-left',
);

// Tight stacks across the board — wrapped title lines hug, year inline sits
// on the same baseline as title.
const gapClass = computed(() =>
    props.variant === 'presentation' || props.variant === 'card' ? 'gap-0' : 'gap-0.5',
);

// Page size — kept smaller than meta/title because the page number is the
// least-emphasized piece of the citation.
const pageSize = computed(() => {
    switch (props.variant) {
        case 'presentation':
            return 'text-[14px] sm:text-[16px]';
        case 'card':
            return 'text-[12px]';
        case 'chip':
        case 'note':
            return 'text-[10.5px]';
    }
    return '';
});

const titleClass = computed(() => [
    titleSize.value,
    'font-body italic leading-none tracking-[-0.005em]',
    props.prominent ? '' : props.mutedTitle ? 'text-mono-200' : 'text-white',
    props.titleHref ? 'hover:underline decoration-mono-500 transition-colors' : '',
]);

// Title color: prominent (essay book-cover slide) uses the warm essay amber
// (--color-essay, #e8a040) so book titles read as part of the essay-themed
// surface. Other variants stay white / mono-200.
const titleStyle = computed(() => {
    if (!props.prominent) return {} as Record<string, string>;
    const out: Record<string, string> = { color: 'var(--color-essay)' };
    if (props.titleSizePx != null) out.fontSize = `${props.titleSizePx}px`;
    return out;
});
</script>

<template>
    <!-- Note variant: year on its own line above the citation row.
         Title uses the soft gold (#e8d0a8) shared with the formatMarkdown
         {name} treatment so book titles in note attributions echo the
         emphasis style used inside note bodies. -->
    <div v-if="isNote" class="flex flex-col gap-1 leading-[1.4]">
        <span class="inline-flex items-baseline gap-1 flex-wrap">
            <span v-if="authors.length" :class="[metaSize, 'font-body text-mono-200']">
                <template v-for="(a, i) in authors" :key="a.full + i">
                    <span v-if="i > 0" class="text-mono-500">{{
                        authors.length === 2 ? ' & ' : ' · '
                        }}</span><span>{{ a.firstParts }}</span><span :style="{ color: a.color }" class="font-medium">{{ a.lastName }}</span><span v-if="a.suffix">{{ a.suffix }}</span><span v-if="i === authors.length - 1">{{ possessiveSuffix(a) }}</span>
                </template>
            </span>
            <component :is="titleHref ? 'a' : 'span'" v-if="title" :href="titleHref || undefined" :target="titleHref ? '_blank' : undefined" :rel="titleHref ? 'noopener noreferrer' : undefined" :class="[titleSize, 'font-body italic leading-[1.2] tracking-[-0.005em]', titleHref && 'hover:underline decoration-mono-500 transition-colors']" style="color: #e8d0a8" @click.stop>{{ title }}</component>
            <span v-if="page" :class="[yearSize, 'text-mono-500']">p.&nbsp;{{ page }}</span>
        </span>
        <span v-if="year" :class="[yearSize, 'leading-none']" style="color: #e8d0a8">{{ year }}</span>
    </div>

    <!-- Inline (chip) variant: single baseline-aligned row -->
    <span v-else-if="isInline" class="inline-flex items-baseline gap-1.5 leading-[1.5]">
        <span v-if="authors.length" :class="[metaSize, 'font-body text-mono-200']">
            <span v-if="dash" class="text-mono-400">—&nbsp;</span>
            <template v-for="(a, i) in authors" :key="a.full + i">
                <span v-if="i > 0" class="text-mono-500">{{
                    authors.length === 2 ? ' & ' : ' · '
                    }}</span><span>{{ a.firstParts }}</span><span :style="{ color: a.color }" class="font-medium">{{ a.lastName }}</span><span v-if="a.suffix">{{ a.suffix }}</span>
            </template>
        </span>
        <component :is="titleHref ? 'a' : 'span'" v-if="title" :href="titleHref || undefined" :target="titleHref ? '_blank' : undefined" :rel="titleHref ? 'noopener noreferrer' : undefined" :class="titleClass" @click.stop>{{ title }}</component>
        <span v-if="page" :class="[metaSize, 'text-mono-500']">p.&nbsp;{{ page }}</span>
    </span>

    <!-- Stacked variants -->
    <div v-else class="flex flex-col font-body" :class="[alignClass, gapClass]">
        <!-- Author row: firstParts in default color, surname colored, suffix default. -->
        <div v-if="authors.length" :class="[metaSize, 'leading-[1.4] text-mono-200']">
            <span v-if="dash" class="text-mono-400">—&nbsp;</span>
            <template v-for="(a, i) in authors" :key="a.full + i">
                <span v-if="i > 0" class="text-mono-500">{{
                    authors.length === 2 ? ' & ' : ' · '
                    }}</span><span>{{ a.firstParts }}</span><span :style="{ color: a.color }" class="font-medium">{{ a.lastName }}</span><span v-if="a.suffix">{{ a.suffix }}</span>
            </template>
        </div>

        <!-- Title + inline year. Wrapper line-height tracks the title's so
             wrapped title lines aren't padded by the (taller) year inline.
             `prominent` (essay book-cover slide) drops the year onto its own
             line below the title for a more deliberate cover-page layout. -->
        <div v-if="title" class="leading-none">
            <component :is="titleHref ? 'a' : 'span'" :href="titleHref || undefined" :target="titleHref ? '_blank' : undefined" :rel="titleHref ? 'noopener noreferrer' : undefined" :class="titleClass" :style="{ 'text-wrap': 'balance', ...titleStyle }" @click.stop>{{ title }}</component><span v-if="year && !prominent" :class="[yearSize, 'text-white ml-1.5']">({{ year }})</span>
        </div>
        <div v-if="year && prominent" :class="[yearSize, 'leading-[1.4] text-white mt-1.5']">{{ year }}</div>

        <!-- Page on its own line below (omitted when no page). -->
        <div v-if="page" :class="[pageSize, 'leading-[1.4] text-mono-400']">p.&nbsp;{{ page }}</div>
    </div>
</template>
