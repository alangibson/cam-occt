<script lang="ts">
    import ThreeColumnLayout from '../ThreeColumnLayout.svelte';
    import ToolBar from '../ToolBar.svelte';
    import LayersList from '../LayersList.svelte';
    import ShapeProperties from '../ShapeProperties.svelte';
    import Units from '../Units.svelte';
    import AccordionPanel from '../AccordionPanel.svelte';
    import DrawingCanvasContainer from '../DrawingCanvasContainer.svelte';
    import { workflowStore } from '$lib/stores/workflow/store';
    import { WorkflowStage } from '$lib/stores/workflow/enums';
    import { drawingStore } from '$lib/stores/drawing/store';
    import { overlayStore } from '$lib/stores/overlay/store';
    import { generateShapePoints } from '$lib/stores/shape/functions';

    // Props from WorkflowContainer for shared canvas
    export let sharedCanvas: typeof DrawingCanvasContainer;
    export let canvasStage: WorkflowStage;
    export let onChainClick: ((chainId: string) => void) | null = null;
    export let onPartClick: ((partId: string) => void) | null = null;

    function handleNext() {
        workflowStore.completeStage(WorkflowStage.EDIT);
        workflowStore.setStage(WorkflowStage.PREPARE);
    }

    // Auto-complete edit stage when drawing exists (user can continue editing and move to next stage anytime)
    $: if ($drawingStore.drawing) {
        workflowStore.completeStage(WorkflowStage.EDIT);
    }

    // Update Edit stage overlay when selected shapes change (only when on edit stage)
    $: if (
        $workflowStore.currentStage === WorkflowStage.EDIT &&
        $drawingStore.drawing &&
        $drawingStore.selectedShapes
    ) {
        const shapePoints = generateShapePoints(
            $drawingStore.drawing.shapes,
            $drawingStore.selectedShapes
        );
        overlayStore.setShapePoints(WorkflowStage.EDIT, shapePoints);
    }
</script>

<div class="edit-stage">
    <ThreeColumnLayout
        leftColumnStorageKey="metalheadcam-edit-left-column-width"
        rightColumnStorageKey="metalheadcam-edit-right-column-width"
    >
        <svelte:fragment slot="left">
            <AccordionPanel title="Layers" isExpanded={true}>
                <LayersList />
            </AccordionPanel>

            <AccordionPanel title="Next Stage" isExpanded={true}>
                <div class="next-stage-content">
                    <button
                        class="next-button"
                        on:click={handleNext}
                        disabled={!$drawingStore.drawing}
                    >
                        Next: Prepare Chains
                    </button>
                    <p class="next-help">
                        Ready to analyze chains and detect parts? Click to
                        continue to the Prepare stage.
                    </p>
                </div>
            </AccordionPanel>
        </svelte:fragment>

        <svelte:fragment slot="center">
            <div class="toolbar-container">
                <ToolBar />
            </div>
            <svelte:component
                this={sharedCanvas}
                currentStage={canvasStage}
                {onChainClick}
                {onPartClick}
            />
        </svelte:fragment>

        <svelte:fragment slot="right">
            <AccordionPanel title="Display Units" isExpanded={true}>
                <Units />
            </AccordionPanel>

            <AccordionPanel title="Shape" isExpanded={true}>
                <ShapeProperties />
            </AccordionPanel>
        </svelte:fragment>
    </ThreeColumnLayout>
</div>

<style>
    .edit-stage {
        display: flex;
        flex-direction: column;
        height: 100%;
        background-color: #f8f9fa;
    }

    .toolbar-container {
        border-bottom: 1px solid #e5e7eb;
        background-color: #fafafa;
    }

    .next-stage-content {
        background: linear-gradient(
            135deg,
            rgb(0, 83, 135) 0%,
            rgb(0, 83, 135) 100%
        );
        color: white;
        border-radius: 0.5rem;
        padding: 1rem;
    }

    .next-button {
        width: 100%;
        padding: 0.75rem 1rem;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 0.375rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-bottom: 0.5rem;
    }

    .next-button:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.5);
    }

    .next-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .next-help {
        margin: 0;
        font-size: 0.875rem;
        color: rgba(255, 255, 255, 0.9);
        line-height: 1.4;
    }
</style>
