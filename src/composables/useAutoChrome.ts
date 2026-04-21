import { ref, onUnmounted } from 'vue';

export function useAutoChrome(hideAfterMs = 2500) {
    const chromeVisible = ref(true);
    let timer: number | null = null;

    function clear() {
        if (timer !== null) {
            window.clearTimeout(timer);
            timer = null;
        }
    }

    function poke() {
        chromeVisible.value = true;
        clear();
        timer = window.setTimeout(() => {
            chromeVisible.value = false;
        }, hideAfterMs);
    }

    function show() {
        chromeVisible.value = true;
        clear();
    }

    onUnmounted(clear);

    return { chromeVisible, poke, show };
}
