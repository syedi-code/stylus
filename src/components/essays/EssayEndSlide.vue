<script setup lang="ts">
import type { Essay } from '../../lib/api';

defineProps<{
    essay: Essay;
}>();

</script>

<template>
    <div class="w-full h-full flex items-center justify-center overflow-y-auto overscroll-contain">
        <div class="w-full max-w-xl px-6 sm:px-10 py-10 flex flex-col gap-6">
            <!-- Bibliography entries: hanging indent, tabular numbering, serif body -->
            <ol class="flex flex-col gap-2.5">
                <li
                    v-for="(ref, i) in essay.references"
                    :key="ref.id"
                    class="grid grid-cols-[2ch_1fr] gap-x-3 text-[13px] leading-[1.35] typography-prose"
                >
                    <span class="font-mono text-[10.5px] text-mono-600 tabular-nums pt-[3px] text-right">
                        {{ (i + 1).toString() }}
                    </span>
                    <span class="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
                        <span class="text-mono-100">{{ ref.book_author }}</span>
                        <span class="italic text-mono-200">{{ ref.book_title }}</span>
                        <span v-if="ref.book_originally_published" class="font-mono text-[11px] text-mono-500 tabular-nums">{{ ref.book_originally_published }}</span>
                        <span v-if="ref.page" class="font-mono text-[11px] text-mono-500 tabular-nums">p.&nbsp;{{ ref.page }}</span>
                    </span>
                </li>
            </ol>
        </div>
    </div>
</template>
