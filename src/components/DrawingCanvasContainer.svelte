<script lang="ts">
    import DrawingCanvas from './DrawingCanvas.svelte';
    import { WorkflowStage } from '$lib/stores/workflow/enums';

    export let onChainClick: ((chainId: string) => void) | null = null;
    export let onPartClick: ((partId: string) => void) | null = null;
    export let disableDragging = false;
    export let currentStage: WorkflowStage;
    export let showToolbar = false;
    export let toolbarContent: string | null = null;
    export let interactionMode: 'shapes' | 'chains' | 'paths' = 'shapes';
</script>

<div class="canvas-container-wrapper">
    {#if showToolbar && toolbarContent}
        <div class="canvas-header">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html toolbarContent}
        </div>
    {/if}

    <div class="canvas-container">
        <DrawingCanvas
            {onChainClick}
            {onPartClick}
            {disableDragging}
            {currentStage}
            {interactionMode}
        />
    </div>
</div>

<style>
    .canvas-container-wrapper {
        flex: 1;
        display: flex;
        flex-direction: column;
        background-color: white;
    }

    .canvas-header {
        padding: 1rem 2rem;
        border-bottom: 1px solid #e5e7eb;
        background-color: #fafafa;
    }

    .canvas-container {
        flex: 1;
        position: relative;
        background-color: white;
        overflow: hidden; /* Prevent canvas from growing container */
        min-height: 0; /* Allow flexbox to shrink */
    }
</style>
