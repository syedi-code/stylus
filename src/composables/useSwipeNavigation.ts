import { ref } from 'vue';

type Direction = 'left' | 'right' | 'down' | null;

interface Options {
    onPrev: () => void;
    onNext: () => void;
    onDismiss: () => void;
    onTap?: (x: number, y: number) => void;
    horizontalThreshold?: number;
    verticalThreshold?: number;
}

export function useSwipeNavigation(opts: Options) {
    const horizThresh = opts.horizontalThreshold ?? 50;
    const vertThresh = opts.verticalThreshold ?? 110;

    const isDragging = ref(false);
    const dragDeltaX = ref(0);
    const dragDeltaY = ref(0);

    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let axis: 'x' | 'y' | null = null;
    let lastX = 0;
    let lastY = 0;

    function onTouchStart(e: TouchEvent) {
        if (e.touches.length !== 1) return;
        isDragging.value = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        lastX = startX;
        lastY = startY;
        startTime = performance.now();
        axis = null;
        dragDeltaX.value = 0;
        dragDeltaY.value = 0;
    }

    function onTouchMove(e: TouchEvent) {
        if (!isDragging.value || e.touches.length !== 1) return;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        const dx = lastX - startX;
        const dy = lastY - startY;

        if (axis === null) {
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            }
        }

        if (axis === 'x') {
            dragDeltaX.value = dx;
            dragDeltaY.value = 0;
        } else if (axis === 'y') {
            dragDeltaY.value = Math.max(0, dy);
            dragDeltaX.value = 0;
        }
    }

    function onTouchEnd(e?: TouchEvent) {
        if (!isDragging.value) return;
        const dx = dragDeltaX.value;
        const dy = dragDeltaY.value;
        const elapsed = Math.max(1, performance.now() - startTime);
        const velocityX = Math.abs(dx) / elapsed;

        let direction: Direction = null;
        if (axis === 'y' && dy > vertThresh) {
            direction = 'down';
        } else if (axis === 'x') {
            const crossed = Math.abs(dx) > horizThresh || velocityX > 0.5;
            if (crossed) direction = dx < 0 ? 'left' : 'right';
        }

        const wasTap = axis === null && elapsed < 300;

        isDragging.value = false;
        dragDeltaX.value = 0;
        dragDeltaY.value = 0;
        axis = null;

        const handled = direction !== null || (wasTap && !!opts.onTap);
        if (handled && e && e.cancelable) e.preventDefault();

        if (direction === 'left') opts.onNext();
        else if (direction === 'right') opts.onPrev();
        else if (direction === 'down') opts.onDismiss();
        else if (wasTap && opts.onTap) opts.onTap(lastX, lastY);
    }

    function onTouchCancel() {
        isDragging.value = false;
        dragDeltaX.value = 0;
        dragDeltaY.value = 0;
        axis = null;
    }

    return {
        isDragging,
        dragDeltaX,
        dragDeltaY,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onTouchCancel,
    };
}
