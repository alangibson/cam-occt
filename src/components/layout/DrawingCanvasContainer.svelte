<script lang="ts">
    import DrawingCanvas from '$components/drawing/DrawingCanvas.svelte';
    import DrawingSVG from '$components/svg/DrawingSVG.svelte';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { settingsStore } from '$lib/stores/settings/store.svelte';
    import { Renderer } from '$lib/config/settings/enums';

    export let onChainClick: ((chainId: string) => void) | null = null;
    export let onPartClick: ((partId: string) => void) | null = null;
    export let currentStage: WorkflowStage;
    export let showToolbar = false;
    export let toolbarContent: string | null = null;
</script>

<div class="canvas-container-wrapper">
    {#if showToolbar && toolbarContent}
        <div class="canvas-header">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html toolbarContent}
        </div>
    {/if}

    <div class="canvas-container">
        {#if settingsStore.settings.renderer === Renderer.Canvas}
            <DrawingCanvas {onChainClick} {onPartClick} {currentStage} />
        {:else if settingsStore.settings.renderer === Renderer.SVG}
            <DrawingSVG />
        {/if}
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
