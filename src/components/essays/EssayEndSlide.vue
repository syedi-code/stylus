<script setup lang="ts">
import type { Essay, Thread } from '../../lib/api';

defineProps<{
    essay: Essay;
    latestThread: Thread | null;
    current: number;
    total: number;
}>();

const emit = defineEmits<{
    (e: 'navigateToThread', threadId: string): void;
}>();

</script>

<template>
    <div class="w-full h-full flex items-center justify-center overflow-y-auto overscroll-contain">
        <div class="w-full max-w-xl px-6 sm:px-10 py-10 flex flex-col gap-6">
            <!-- Badge row -->
            <div class="flex items-center gap-2 flex-wrap">
                <span class="bg-essay text-essay-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">
                    essay
                </span>
                <span v-if="essay.version && essay.version > 1" class="bg-gold text-gold-text px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] leading-[1.5]">
                    v{{ essay.version }}
                </span>
                <button
                    v-if="latestThread"
                    @click.stop="emit('navigateToThread', latestThread.id)"
                    class="inline-flex items-baseline gap-1 cursor-pointer group/thread min-w-0"
                >
                    <span class="text-[10.5px] italic text-mono-500 group-hover/thread:text-mono-400 transition-colors">in</span>
                    <span class="text-[11.5px] font-medium text-thread-muted group-hover/thread:text-thread transition-colors truncate">{{ latestThread.name }}</span>
                </button>
            </div>

            <!-- Bibliography heading -->
            <div class="font-mono text-[10px] uppercase tracking-[0.2em] text-mono-400">
                References
            </div>

            <!-- Bibliography entries: hanging indent, tabular numbering, serif body -->
            <ol v-if="essay.references.length" class="flex flex-col gap-3.5">
                <li
                    v-for="(ref, i) in essay.references"
                    :key="ref.id"
                    class="grid grid-cols-[2ch_1fr] gap-x-3 text-[13px] leading-[1.55] typography-prose"
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

            <div v-else class="text-[12px] text-mono-600 italic font-serif">
                No references.
            </div>

            <!-- Counter -->
            <div class="text-center pt-2">
                <span class="font-mono text-[11px] text-gold tracking-[0.12em]">{{ current + 1 }} / {{ total }}</span>
            </div>
        </div>
    </div>
</template>
