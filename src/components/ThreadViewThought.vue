<script setup lang="ts">
import { computed } from 'vue';
import type { Thought } from '../lib/api';
import { formatMarkdown } from '../lib/formatText';
import { useTypography } from '../composables/useTypography';

const props = defineProps<{
  thought: Thought;
}>();

const moodEmojis = ['😢', '😔', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩', '🥳'];

const moodEmoji = computed(() => {
  if (props.thought.mood_score === undefined || props.thought.mood_score === null) return null;
  return moodEmojis[props.thought.mood_score - 1] || null;
});

const formattedContent = computed(() => formatMarkdown(props.thought.content));

const contentLength = computed(() => props.thought.content?.length ?? 0);
const { baseFontSize, lineHeightClass, typographyClass } = useTypography('thought', 'thread', contentLength);
</script>

<template>
  <div class="flex flex-col gap-1.5 p-3 sm:p-4 bg-mono-900 border border-rose/20 rounded-lg">
    <!-- Type badge -->
    <div class="flex items-center gap-1.5 mb-1">
      <span class="bg-rose text-white px-1.5 py-px text-[10px] font-bold uppercase tracking-wider">
        thought
      </span>
    </div>

    <!-- Content -->
    <p lang="en" :class="[typographyClass, lineHeightClass, 'text-mono-100 whitespace-pre-wrap wrap-break-word']" :style="{ fontSize: baseFontSize + 'px' }" v-html="formattedContent"></p>

    <!-- Mood Display -->
    <div v-if="moodEmoji || (thought.mood_tags && thought.mood_tags.length > 0)" class="flex items-center gap-2 flex-wrap">
      <span v-if="moodEmoji" class="inline-flex items-center gap-1 text-lg" :title="`Mood: ${thought.mood_score}/10`">
        {{ moodEmoji }}
        <span class="text-xs font-mono text-rose">{{ thought.mood_score }}/10</span>
      </span>
      <span v-for="tag in thought.mood_tags" :key="tag" class="px-2 py-0.5 text-xs bg-rose/15 text-rose-bright rounded-full border border-rose/20">
        {{ tag }}
      </span>
    </div>


  </div>
</template>
