<script lang="ts">
  import CuttingParameters from '../CuttingParameters.svelte';
  import DrawingCanvas from '../DrawingCanvas.svelte';
  import LayersInfo from '../LayersInfo.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import { drawingStore } from '../../lib/stores/drawing';
  import { chainStore, setChains, setTolerance } from '../../lib/stores/chains';
  import { detectShapeChains } from '../../lib/algorithms/chain-detection';
  import type { CuttingParameters as CuttingParametersType, Shape } from '../../types';
  import type { ShapeChain } from '../../lib/algorithms/chain-detection';

  let cuttingParameters: CuttingParametersType = {
    feedRate: 1000,
    pierceHeight: 3.8,
    pierceDelay: 0.5,
    cutHeight: 1.5,
    kerf: 1.5,
    leadInLength: 5,
    leadOutLength: 5
  };

  // Chain detection parameters
  let tolerance = $chainStore.tolerance;
  let isDetectingChains = false;
  
  // Reactive chain data
  $: detectedChains = $chainStore.chains;

  function handleNext() {
    workflowStore.completeStage('program');
    workflowStore.setStage('simulate');
  }

  function handleDetectChains() {
    isDetectingChains = true;
    
    try {
      // Get current drawing shapes from drawing store
      const currentDrawing = $drawingStore.drawing;
      if (!currentDrawing || !currentDrawing.shapes) {
        console.warn('No drawing available for chain detection');
        setChains([]);
        return;
      }

      // Update tolerance in store
      setTolerance(tolerance);
      
      // Detect chains and update store
      const chains = detectShapeChains(currentDrawing.shapes, { tolerance });
      setChains(chains);
      
      console.log(`Detected ${chains.length} chains with ${chains.reduce((sum, chain) => sum + chain.shapes.length, 0)} total shapes`);
    } catch (error) {
      console.error('Error detecting chains:', error);
      setChains([]);
    } finally {
      isDetectingChains = false;
    }
  }

  // Auto-complete program stage (user can adjust parameters and continue)
  workflowStore.completeStage('program');
</script>

<div class="program-stage">
  <div class="program-layout">
    <!-- Left Column -->
    <div class="left-column">
      <!-- <div class="panel">
        <h3 class="panel-title">Cutting Parameters</h3>
        <CuttingParameters bind:parameters={cuttingParameters} units="mm" />
      </div> -->

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
        <div class="chain-detection-toolbar">
          <div class="toolbar-section">
            <label class="input-label">
              Tolerance (units):
              <input 
                type="number" 
                bind:value={tolerance} 
                min="0.001" 
                max="10" 
                step="0.001"
                class="tolerance-input"
              />
            </label>
            
            <button 
              class="detect-chains-button"
              on:click={handleDetectChains}
              disabled={isDetectingChains}
            >
              {isDetectingChains ? 'Detecting...' : 'Detect Chains'}
            </button>
          </div>

          {#if detectedChains.length > 0}
            <div class="toolbar-results">
              <span class="chain-summary-inline">
                {detectedChains.length} chains with {detectedChains.reduce((sum, chain) => sum + chain.shapes.length, 0)} connected shapes
              </span>
            </div>
          {/if}
        </div>
      </div>
      <div class="canvas-container">
        <DrawingCanvas respectLayerVisibility={false} treatChainsAsEntities={true} />
      </div>
    </div>

    <!-- Right Column -->
    <div class="right-column">
      <!-- Hidden for now -->
      <!-- <div class="panel">
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
      </div> -->
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

  .canvas-header {
    padding: 1rem 2rem;
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


  .input-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .tolerance-input {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background-color: white;
    transition: border-color 0.2s ease;
  }

  .tolerance-input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .detect-chains-button {
    padding: 0.75rem 1rem;
    background-color: #4f46e5;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .detect-chains-button:hover:not(:disabled) {
    background-color: #4338ca;
  }

  .detect-chains-button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }


  /* Toolbar styles */
  .chain-detection-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
  }

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .toolbar-results {
    display: flex;
    align-items: center;
  }

  .chain-summary-inline {
    font-size: 0.875rem;
    color: #4b5563;
    font-weight: 500;
    padding: 0.5rem 0.75rem;
    background-color: #f0f9ff;
    border: 1px solid #0ea5e9;
    border-radius: 0.375rem;
  }
</style>