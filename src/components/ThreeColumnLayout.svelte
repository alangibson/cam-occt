<script lang="ts">
    import ResizableColumn from './ResizableColumn.svelte';

    export let leftColumnStorageKey: string;
    export let rightColumnStorageKey: string;
    export let leftColumnWidth = 280;
    export let rightColumnWidth = 280;

    let isDragging = false;

    // Track dragging state from child components
    function handleDragStart() {
        isDragging = true;
    }

    function handleDragEnd() {
        isDragging = false;
    }
</script>

<div class="three-column-layout" class:no-select={isDragging}>
    <!-- Left Column - only render if width > 0 -->
    {#if leftColumnWidth > 0}
        <ResizableColumn
            bind:width={leftColumnWidth}
            storageKey={leftColumnStorageKey}
            position="left"
            on:dragstart={handleDragStart}
            on:dragend={handleDragEnd}
        >
            <slot name="left" />
        </ResizableColumn>
    {/if}

    <!-- Center Column -->
    <div class="center-column">
        <slot name="center" />
    </div>

    <!-- Right Column -->
    <ResizableColumn
        bind:width={rightColumnWidth}
        storageKey={rightColumnStorageKey}
        position="right"
        on:dragstart={handleDragStart}
        on:dragend={handleDragEnd}
    >
        <slot name="right" />
    </ResizableColumn>
</div>

<style>
    .three-column-layout {
        display: flex;
        flex: 1;
        overflow: hidden;
    }

    .center-column {
        flex: 1;
        display: flex;
        flex-direction: column;
        background-color: white;
    }

    /* Prevent text selection during resize */
    .three-column-layout.no-select {
        user-select: none;
    }

    @media (max-width: 768px) {
        .three-column-layout {
            flex-direction: column;
        }

        .center-column {
            flex: 1;
            min-height: 400px;
        }
    }
</style>
