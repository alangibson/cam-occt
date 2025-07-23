<script lang="ts">
  import CuttingParameters from '../CuttingParameters.svelte';
  import DrawingCanvas from '../DrawingCanvas.svelte';
  import LayersInfo from '../LayersInfo.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import type { CuttingParameters as CuttingParametersType } from '../../types';

  let cuttingParameters: CuttingParametersType = {
    feedRate: 1000,
    pierceHeight: 3.8,
    pierceDelay: 0.5,
    cutHeight: 1.5,
    kerf: 1.5,
    leadInLength: 5,
    leadOutLength: 5
  };

  function handleNext() {
    workflowStore.completeStage('program');
    workflowStore.setStage('simulate');
  }

  // Auto-complete program stage (user can adjust parameters and continue)
  workflowStore.completeStage('program');
</script>

<div class="program-stage">
  <div class="program-layout">
    <!-- Left Column -->
    <div class="left-column">
      <div class="panel">
        <h3 class="panel-title">Cutting Parameters</h3>
        <CuttingParameters bind:parameters={cuttingParameters} units="mm" />
      </div>

      <div class="panel">
        <LayersInfo />
      </div>

      <div class="panel next-stage-panel">
        <button 
          class="next-button"
          on:click={handleNext}
        >
          Next: Simulate Cutting
        </button>
        <p class="next-help">
          Review your tool paths and simulate the cutting process.
        </p>
      </div>
    </div>

    <!-- Center Column -->
    <div class="center-column">
      <div class="canvas-header">
        <h2>Programmed Tool Paths</h2>
        <p>Tool paths will be overlaid on your drawing geometry</p>
      </div>
      <div class="canvas-container">
        <DrawingCanvas respectLayerVisibility={false} />
      </div>
    </div>

    <!-- Right Column -->
    <div class="right-column">
      <div class="panel">
        <h3 class="panel-title">Tool Path Information</h3>
        <p class="placeholder-text">
          Tool path generation and optimization features will be implemented here.
        </p>
        <ul class="info-list">
          <li>Total cutting length: <strong>--</strong></li>
          <li>Estimated cut time: <strong>--</strong></li>
          <li>Number of pierces: <strong>--</strong></li>
          <li>Tool path optimization: <strong>Enabled</strong></li>
        </ul>
      </div>
    </div>
  </div>
</div>

<style>
  .program-stage {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #f8f9fa;
  }

  .program-layout {
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

  .canvas-header {
    padding: 1rem 2rem;
    border-bottom: 1px solid #e5e7eb;
    background-color: #fafafa;
  }

  .canvas-header h2 {
    margin: 0 0 0.25rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
  }

  .canvas-header p {
    margin: 0;
    color: #6b7280;
    font-size: 0.875rem;
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

  .next-button:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .next-help {
    margin: 0;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.4;
  }

  .placeholder-text {
    margin: 0 0 1rem 0;
    color: #6b7280;
    font-style: italic;
  }

  .info-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .info-list li {
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
    color: #4b5563;
  }

  .info-list li:last-child {
    border-bottom: none;
  }

  .info-list strong {
    color: #374151;
  }
</style>