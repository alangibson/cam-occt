<script lang="ts">
    import { onMount } from 'svelte';

    export let width = 280; // Default width in pixels
    export let minWidth = 200;
    export let maxWidth = 600;
    export let storageKey: string;
    export let position: 'left' | 'right' = 'left';

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    // Load width from localStorage on mount
    onMount(() => {
        const savedWidth = localStorage.getItem(storageKey);
        if (savedWidth) {
            width = parseInt(savedWidth, 10);
        }
    });

    // Save width to localStorage
    function saveWidth() {
        localStorage.setItem(storageKey, width.toString());
    }

    // Resize handlers
    function handleResizeStart(e: MouseEvent) {
        isDragging = true;
        startX = e.clientX;
        startWidth = width;
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', handleResizeEnd);
        e.preventDefault();
    }

    function handleResize(e: MouseEvent) {
        if (!isDragging) return;

        let deltaX = e.clientX - startX;
        // Reverse delta for right column
        if (position === 'right') {
            deltaX = startX - e.clientX;
        }

        const newWidth = Math.max(
            minWidth,
            Math.min(maxWidth, startWidth + deltaX)
        );
        width = newWidth;
    }

    function handleResizeEnd() {
        isDragging = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', handleResizeEnd);
        saveWidth();
    }

    // Keyboard support
    function handleKeydown(e: KeyboardEvent) {
        let adjustment = 0;

        if (e.key === 'ArrowLeft') {
            adjustment = position === 'left' ? -10 : 10;
        } else if (e.key === 'ArrowRight') {
            adjustment = position === 'left' ? 10 : -10;
        }

        if (adjustment !== 0) {
            width = Math.max(minWidth, Math.min(maxWidth, width + adjustment));
            saveWidth();
            e.preventDefault();
        }
    }
</script>

<div
    class="resizable-column"
    style="width: {width}px;"
    class:no-select={isDragging}
>
    <!-- Resize handle -->
    <button
        class="resize-handle resize-handle-{position}"
        on:mousedown={handleResizeStart}
        on:keydown={handleKeydown}
        class:dragging={isDragging}
        aria-label="Resize {position} panel (Arrow keys to adjust)"
        type="button"
    ></button>

    <slot />
</div>

<style>
    .resizable-column {
        background-color: #f5f5f5;
        border-right: 1px solid #e5e7eb;
        padding: 0.5rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-height: 0; /* Allow flex child to shrink */
        flex-shrink: 0; /* Prevent column from shrinking */
        position: relative; /* For resize handle positioning */
    }

    .resizable-column:last-child {
        border-right: none;
        border-left: 1px solid #e5e7eb;
    }

    /* Resize handle styles */
    .resize-handle {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 6px;
        cursor: col-resize;
        background: transparent;
        border: none;
        padding: 0;
        z-index: 10;
        transition: background-color 0.2s ease;
    }

    .resize-handle:hover {
        background-color: rgb(0, 83, 135);
        opacity: 0.3;
    }

    .resize-handle.dragging {
        background-color: rgb(0, 83, 135);
        opacity: 0.5;
    }

    .resize-handle-left {
        right: -3px; /* Half of width to center on border */
    }

    .resize-handle-right {
        left: -3px; /* Half of width to center on border */
    }

    /* Prevent text selection during resize */
    .resizable-column.no-select {
        user-select: none;
    }

    @media (max-width: 768px) {
        .resizable-column {
            width: 100% !important;
            height: auto;
            max-height: 200px;
        }
    }
</style>
