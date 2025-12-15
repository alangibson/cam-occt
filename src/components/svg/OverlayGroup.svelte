<script lang="ts">
    import { overlayStore } from '$lib/stores/overlay/store.svelte';
    import { drawingStore } from '$lib/stores/drawing/store.svelte';
    import type { WorkflowStage } from '$lib/stores/workflow/enums';

    type Props = {
        currentStage: WorkflowStage;
        zoomScale: number;
    };

    let { currentStage, zoomScale }: Props = $props();

    // Get toolhead position for current stage
    const toolHead = $derived(overlayStore.overlays[currentStage]?.toolHead);

    // Constant size in screen pixels (10px as requested)
    const TOOL_HEAD_SCREEN_SIZE = 10;

    // Get unit scale from drawing store
    const unitScale = $derived(drawingStore.unitScale);

    // Calculate world-space size from screen pixels
    // Need to divide by both zoom scale and unit scale to maintain constant screen size
    const toolHeadWorldSize = $derived(
        TOOL_HEAD_SCREEN_SIZE / (zoomScale * unitScale)
    );
</script>

<!-- Overlay layer for simulation toolhead -->
{#if toolHead && toolHead.visible}
    <g class="toolhead-overlay">
        <!-- Draw red cross at toolhead position (10px x 10px screen size) -->
        <line
            x1={toolHead.x - toolHeadWorldSize / 2}
            y1={toolHead.y}
            x2={toolHead.x + toolHeadWorldSize / 2}
            y2={toolHead.y}
            stroke="rgb(133, 18, 0)"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
        />
        <line
            x1={toolHead.x}
            y1={toolHead.y - toolHeadWorldSize / 2}
            x2={toolHead.x}
            y2={toolHead.y + toolHeadWorldSize / 2}
            stroke="rgb(133, 18, 0)"
            stroke-width="1"
            vector-effect="non-scaling-stroke"
        />
    </g>
{/if}
