<script lang="ts">
  import DrawingCanvas from '../DrawingCanvas.svelte';
  import ToolBar from '../ToolBar.svelte';
  import LayersList from '../LayersList.svelte';
  import ShapeProperties from '../ShapeProperties.svelte';
  import Units from '../Units.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import { drawingStore } from '../../lib/stores/drawing';
  import { overlayStore, generateShapePoints } from '../../lib/stores/overlay';

  function handleNext() {
    workflowStore.completeStage('edit');
    workflowStore.setStage('prepare');
  }

  // Auto-complete edit stage when drawing exists (user can continue editing and move to next stage anytime)
  $: if ($drawingStore.drawing) {
    workflowStore.completeStage('edit');
  }

  // Update Edit stage overlay when selected shapes change
  $: if ($drawingStore.drawing && $drawingStore.selectedShapes) {
    const shapePoints = generateShapePoints($drawingStore.drawing.shapes, $drawingStore.selectedShapes);
    overlayStore.setShapePoints('edit', shapePoints);
  }
</script>

<div class="edit-stage">
  <div class="edit-layout">
    <!-- Left Column -->
    <div class="left-column">
      <div class="panel">
        <h3 class="panel-title">Display Units</h3>
        <Units />
      </div>
      
      <div class="panel">
        <LayersList />
      </div>

      <div class="panel next-stage-panel">
        <button 
          class="next-button"
          on:click={handleNext}
          disabled={!$drawingStore.drawing}
        >
          Next: Prepare Chains
        </button>
        <p class="next-help">
          Ready to analyze chains and detect parts? Click to continue to the Prepare stage.
        </p>
      </div>
    </div>

    <!-- Center Column -->
    <div class="center-column">
      <div class="toolbar-container">
        <ToolBar />
      </div>
      <div class="canvas-container">
        <DrawingCanvas currentStage="edit" />
      </div>
    </div>

    <!-- Right Column -->
    <div class="right-column">
      <div class="panel">
        <h3 class="panel-title">Shape Properties</h3>
        <ShapeProperties />
      </div>
    </div>
  </div>
</div>

<style>
  .edit-stage {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #f8f9fa;
  }

  .edit-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .left-column {
    width: 280px;
    background-color: #f5f5f5;
    border-right: 1px solid #e5e7eb;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .center-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: white;
  }

  .right-column {
    width: 280px;
    background-color: #f5f5f5;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
    overflow-y: auto;
  }

  .panel {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .panel-title {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
    padding-bottom: 0.5rem;
  }

  .toolbar-container {
    border-bottom: 1px solid #e5e7eb;
    background-color: #fafafa;
  }

  .canvas-container {
    flex: 1;
    position: relative;
    background-color: white;
  }

  .next-stage-panel {
    margin-top: auto;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    border: none;
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

  /* Responsive design */
  @media (max-width: 1200px) {
    .left-column,
    .right-column {
      width: 240px;
    }
  }

  @media (max-width: 768px) {
    .edit-layout {
      flex-direction: column;
    }

    .left-column,
    .right-column {
      width: 100%;
      height: auto;
      max-height: 200px;
    }

    .center-column {
      flex: 1;
      min-height: 400px;
    }
  }
</style>