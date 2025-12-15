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
    let isCollapsed = false;
    let expandedWidth = width; // Store width before collapsing
    const collapsedWidth = 10; // Just the handle width

    // Load width and collapse state from localStorage on mount
    onMount(() => {
        const savedWidth = localStorage.getItem(storageKey);
        const savedCollapsed = localStorage.getItem(`${storageKey}-collapsed`);

        if (savedWidth) {
            const parsedWidth = parseInt(savedWidth, 10);
            expandedWidth = parsedWidth;
            width = parsedWidth;
        }

        if (savedCollapsed === 'true') {
            isCollapsed = true;
            width = collapsedWidth;
        }
    });

    // Save width to localStorage
    function saveWidth() {
        if (!isCollapsed) {
            localStorage.setItem(storageKey, width.toString());
            expandedWidth = width;
        }
    }

    // Save collapse state
    function saveCollapseState() {
        localStorage.setItem(`${storageKey}-collapsed`, isCollapsed.toString());
    }

    // Toggle collapse/expand
    function handleDoubleClick() {
        isCollapsed = !isCollapsed;

        if (isCollapsed) {
            // Collapsing: save current width and set to collapsed width
            expandedWidth = width;
            width = collapsedWidth;
        } else {
            // Expanding: restore saved width
            width = expandedWidth;
        }

        saveCollapseState();
        if (!isCollapsed) {
            saveWidth();
        }
    }

    // Resize handlers
    function handleResizeStart(e: MouseEvent) {
        // Don't allow resizing when collapsed
        if (isCollapsed) return;

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
        // Don't allow keyboard resize when collapsed
        if (isCollapsed) return;

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
    class="resizable-column-wrapper"
    style="width: {width}px;"
    class:no-select={isDragging}
    class:collapsed={isCollapsed}
>
    <!-- Scrollable content area -->
    <div class="resizable-column" class:hidden={isCollapsed}>
        <slot />
    </div>

    <!-- Dedicated resize handle column -->
    <div class="resize-handle-column resize-handle-column-{position}">
        <button
            class="resize-handle"
            on:mousedown={handleResizeStart}
            on:dblclick={handleDoubleClick}
            on:keydown={handleKeydown}
            class:dragging={isDragging}
            aria-label="Resize {position} panel (Arrow keys to adjust, Double-click to collapse/expand)"
            type="button"
        >
            <div class="handle-indicator"></div>
        </button>
    </div>
</div>

<style>
    .resizable-column-wrapper {
        display: flex;
        flex-shrink: 0;
        position: relative;
        min-height: 0;
        transition: width 0.2s ease;
    }

    .resizable-column {
        flex: 1;
        background-color: #f5f5f5;
        padding: 0.5rem;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-height: 0;
        transition: opacity 0.2s ease;
    }

    .resizable-column.hidden {
        display: none;
    }

    .resizable-column-wrapper:not(:last-child) .resizable-column {
        border-right: 1px solid #e5e7eb;
    }

    .resizable-column-wrapper:last-child .resizable-column {
        border-left: 1px solid #e5e7eb;
    }

    /* Thin column for resize handle */
    .resize-handle-column {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 10;
    }

    .resize-handle-column-left {
        right: 0;
    }

    .resize-handle-column-right {
        left: 0;
    }

    /* Resize handle styles */
    .resize-handle {
        width: 100%;
        height: 100%;
        cursor: col-resize;
        background: transparent;
        border: none;
        padding: 0;
        pointer-events: auto;
        transition: background-color 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .resize-handle:hover {
        background-color: rgb(0, 83, 135);
        opacity: 0.3;
    }

    .resize-handle.dragging {
        background-color: rgb(0, 83, 135);
        opacity: 0.5;
    }

    /* Visual indicator - 6-dot grip pattern (2 columns × 3 rows) */
    .handle-indicator {
        width: 8px;
        height: 40px;
        position: relative;
        pointer-events: none;
        transition: all 0.15s ease;
        background-image:
            radial-gradient(circle, #9ca3af 1px, transparent 1px),
            radial-gradient(circle, #9ca3af 1px, transparent 1px);
        background-size: 4px 4px;
        background-position:
            0 0,
            4px 0;
        background-repeat: repeat-y;
    }

    .resize-handle:hover .handle-indicator {
        background-image:
            radial-gradient(circle, rgb(0, 83, 135) 1px, transparent 1px),
            radial-gradient(circle, rgb(0, 83, 135) 1px, transparent 1px);
    }

    .resize-handle.dragging .handle-indicator {
        background-image:
            radial-gradient(circle, rgb(0, 83, 135) 1px, transparent 1px),
            radial-gradient(circle, rgb(0, 83, 135) 1px, transparent 1px);
    }

    /* Prevent text selection during resize */
    .resizable-column-wrapper.no-select {
        user-select: none;
    }

    @media (max-width: 768px) {
        .resizable-column-wrapper {
            width: 100% !important;
        }

        .resizable-column {
            height: auto;
            max-height: 200px;
        }
    }
</style>
