<script lang="ts">
  import DrawingCanvas from '../DrawingCanvas.svelte';
  import CuttingParameters from '../CuttingParameters.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import { drawingStore } from '../../lib/stores/drawing';
  import { chainStore } from '../../lib/stores/chains';
  import { partStore } from '../../lib/stores/parts';
  import { detectShapeChains } from '../../lib/algorithms/chain-detection';
  import { detectParts, isChainClosed } from '../../lib/algorithms/part-detection';
  import { setChains, setTolerance } from '../../lib/stores/chains';
  import { setParts } from '../../lib/stores/parts';
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
  
  let tolerance = 0.1;

  // Subscribe to stores
  $: drawing = $drawingStore.drawing;
  $: chains = $chainStore.chains;
  $: parts = $partStore.parts;
  $: chainTolerance = $chainStore.tolerance;

  // Update tolerance when it changes
  $: if (tolerance !== chainTolerance) {
    setTolerance(tolerance);
  }

  function handleDetectChains() {
    if (!drawing) return;
    
    const detectedChains = detectShapeChains(drawing.shapes, { tolerance });
    setChains(detectedChains);
  }

  async function handleDetectParts() {
    if (chains.length === 0) {
      alert('Please detect chains first');
      return;
    }
    
    const result = await detectParts(chains, tolerance);
    setParts(result.parts, result.warnings);
  }

  function handleNext() {
    workflowStore.completeStage('program');
    workflowStore.setStage('simulate');
  }

  // Auto-detect chains when drawing changes
  $: if (drawing && drawing.shapes.length > 0) {
    handleDetectChains();
  }

  // Auto-detect parts when chains change
  $: if (chains.length > 0) {
    handleDetectParts();
  }

  // Helper function to check if a chain is closed
  function isChainClosedHelper(chain: any): boolean {
    return isChainClosed(chain, tolerance);
  }

  // Auto-complete program stage (user can adjust parameters and continue)
  workflowStore.completeStage('program');
</script>

<div class="program-stage">
  <div class="program-layout">
    <!-- Left Column - Parts and Chains -->
    <div class="left-column">
      <div class="panel">
        <h3 class="panel-title">Chain Detection</h3>
        <div class="tolerance-input">
          <label for="tolerance">Tolerance ({$drawingStore.displayUnit}):</label>
          <input
            id="tolerance"
            type="number"
            bind:value={tolerance}
            min="0.001"
            max="10"
            step="0.01"
            class="tolerance-field"
          />
        </div>
        <button class="detect-button" on:click={handleDetectChains}>
          Detect Chains
        </button>
      </div>

      {#if chains.length > 0}
        <div class="panel">
          <h3 class="panel-title">Chains ({chains.length})</h3>
          <div class="chain-list">
            {#each chains as chain (chain.id)}
              <div class="chain-item">
                <span class="chain-name">Chain {chain.id.split('-')[1]}</span>
                <span class="chain-info">{chain.shapes.length} shapes</span>
                <span class="chain-status {isChainClosedHelper(chain) ? 'closed' : 'open'}">
                  {isChainClosedHelper(chain) ? 'Closed' : 'Open'}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if parts.length > 0}
        <div class="panel">
          <h3 class="panel-title">Parts ({parts.length})</h3>
          <div class="parts-list">
            {#each parts as part (part.id)}
              <div class="part-item">
                <span class="part-name">Part {part.id.split('-')[1]}</span>
                <span class="part-info">{part.holes.length} holes</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

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

    <!-- Center Column - Drawing Canvas -->
    <div class="center-column">
      <div class="canvas-container">
        {#if drawing}
          <DrawingCanvas 
            treatChainsAsEntities={true}
            disableDragging={true}
            currentStage="program"
          />
        {:else}
          <div class="no-drawing">
            <h3>No Drawing Loaded</h3>
            <p>Please import a drawing file to begin programming tool paths.</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Right Column - Cutting Parameters -->
    <div class="right-column">
      <div class="panel">
        <h3 class="panel-title">Cutting Parameters</h3>
        <CuttingParameters bind:parameters={cuttingParameters} units={$drawingStore.displayUnit || 'mm'} />
      </div>
      
      <div class="panel">
        <h3 class="panel-title">Path Information</h3>
        <div class="path-info">
          <div class="info-item">
            <span class="info-label">Total Chains:</span>
            <span class="info-value">{chains.length}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Total Parts:</span>
            <span class="info-value">{parts.length}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Cut Paths:</span>
            <span class="info-value">{chains.length} (default)</span>
          </div>
        </div>
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

  .tolerance-input {
    margin-bottom: 1rem;
  }

  .tolerance-input label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .tolerance-field {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .detect-button {
    width: 100%;
    padding: 0.5rem 1rem;
    background-color: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .detect-button:hover {
    background-color: #2563eb;
  }

  .canvas-container {
    flex: 1;
    position: relative;
    background-color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .no-drawing {
    text-align: center;
    color: #6b7280;
    max-width: 400px;
  }

  .no-drawing h3 {
    margin: 0 0 1rem 0;
    color: #374151;
  }

  .chain-list, .parts-list {
    max-height: 200px;
    overflow-y: auto;
  }

  .chain-item, .part-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
    font-size: 0.875rem;
  }

  .chain-item:last-child, .part-item:last-child {
    border-bottom: none;
  }

  .chain-name, .part-name {
    font-weight: 500;
    color: #374151;
  }

  .chain-info, .part-info {
    color: #6b7280;
    font-size: 0.75rem;
  }

  .chain-status {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-weight: 500;
  }

  .chain-status.closed {
    background-color: #dcfce7;
    color: #166534;
  }

  .chain-status.open {
    background-color: #fef3c7;
    color: #92400e;
  }

  .path-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
  }

  .info-label {
    color: #6b7280;
  }

  .info-value {
    font-weight: 500;
    color: #374151;
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

  .panel-title {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
    padding-bottom: 0.5rem;
  }


</style>