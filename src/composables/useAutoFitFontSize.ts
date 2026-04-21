import { ref, watch, onMounted, onUnmounted, nextTick, type Ref } from 'vue';
import { FONT_SIZE_MIN } from './usePresentationFontSize';

export function useAutoFitFontSize(
    containerRef: Ref<HTMLElement | null>,
    textRef: Ref<HTMLElement | null>,
    preferredSize: Ref<number>,
) {
    const fittedSize = ref(preferredSize.value);
    let ro: ResizeObserver | null = null;
    let scheduled = false;

    function measure() {
        const container = containerRef.value;
        const text = textRef.value;
        if (!container || !text) return;

        if (container.clientHeight <= 0) return;

        let size = preferredSize.value;
        text.style.fontSize = size + 'px';

        let guard = 0;
        while (
            size > FONT_SIZE_MIN &&
            container.scrollHeight > container.clientHeight &&
            guard++ < 60
        ) {
            size -= 1;
            text.style.fontSize = size + 'px';
        }

        fittedSize.value = size;
    }

    function schedule() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            measure();
        });
    }

    onMounted(() => {
        nextTick(measure);
        if (containerRef.value && 'ResizeObserver' in window) {
            ro = new ResizeObserver(schedule);
            ro.observe(containerRef.value);
        }
    });

    onUnmounted(() => {
        ro?.disconnect();
        ro = null;
    });

    watch(preferredSize, () => nextTick(measure));

    return { fittedSize, remeasure: schedule };
}
