<script lang="ts">
  import { drawingStore } from '../lib/stores/drawing';
  import { decomposePolylines } from '../lib/algorithms/decompose-polylines';
  import { translateToPositiveQuadrant } from '../lib/algorithms/translate-to-positive';
  import { joinColinearLinesInChains } from '../lib/algorithms/join-colinear-lines';
  import { detectShapeChains } from '../lib/algorithms/chain-detection';
  import { TOLERANCE } from '../lib/constants';
  import type { Shape, Point2D } from '../lib/types';
  
  $: selectedCount = $drawingStore.selectedShapes.size;
  $: fileName = $drawingStore.fileName;
  
  function handleScale() {
    const factor = parseFloat(prompt('Enter scale factor:', '1.5') || '1');
    if (factor && selectedCount > 0) {
      // Scale around center of selection
      drawingStore.scaleShapes(
        Array.from($drawingStore.selectedShapes),
        factor,
        { x: 0, y: 0 } // TODO: Calculate center of selection
      );
    }
  }
  
  function handleRotate() {
    const degrees = parseFloat(prompt('Enter rotation angle (degrees):', '45') || '0');
    if (degrees && selectedCount > 0) {
      const radians = degrees * Math.PI / 180;
      drawingStore.rotateShapes(
        Array.from($drawingStore.selectedShapes),
        radians,
        { x: 0, y: 0 } // TODO: Calculate center of selection
      );
    }
  }
  
  function handleDecomposePolylines() {
    const drawing = $drawingStore.drawing;
    if (!drawing || !drawing.shapes || drawing.shapes.length === 0) {
      alert('No drawing loaded or no shapes to decompose.');
      return;
    }
    
    const decomposedShapes = decomposePolylines(drawing.shapes);
    drawingStore.replaceAllShapes(decomposedShapes);
  }
  
  function handleTranslateToPositive() {
    const drawing = $drawingStore.drawing;
    if (!drawing || !drawing.shapes || drawing.shapes.length === 0) {
      alert('No drawing loaded or no shapes to translate.');
      return;
    }
    
    const translatedShapes = translateToPositiveQuadrant(drawing.shapes);
    drawingStore.replaceAllShapes(translatedShapes);
  }
  
  function handleJoinColinearLines() {
    const drawing = $drawingStore.drawing;
    if (!drawing || !drawing.shapes || drawing.shapes.length === 0) {
      alert('No drawing loaded or no shapes to join.');
      return;
    }
    
    try {
      // First detect chains from current shapes
      const chains = detectShapeChains(drawing.shapes, { tolerance: TOLERANCE });
      
      // Join collinear lines in the chains
      const joinedChains = joinColinearLinesInChains(chains, TOLERANCE);
      
      // Extract all shapes from the joined chains
      const allJoinedShapes = joinedChains.flatMap(chain => chain.shapes);
      
      // Update the drawing with the joined shapes
      drawingStore.replaceAllShapes(allJoinedShapes);
      
      console.log(`Line joining complete. Original: ${drawing.shapes.length} shapes, Joined: ${allJoinedShapes.length} shapes`);
    } catch (error) {
      console.error('Error joining colinear lines:', error);
      alert('Error joining colinear lines. Check console for details.');
    }
  }

</script>

<div class="toolbar">
  <div class="toolbar-left">
    <div class="button-group">
      <button
        on:click={() => drawingStore.deleteSelected()}
        disabled={selectedCount === 0}
      >
        Delete ({selectedCount})
      </button>
      
      <button
        on:click={handleScale}
        disabled={selectedCount === 0}
      >
        Scale
      </button>
      
      <button
        on:click={handleRotate}
        disabled={selectedCount === 0}
      >
        Rotate
      </button>
      
      <button
        on:click={() => drawingStore.clearSelection()}
        disabled={selectedCount === 0}
      >
        Clear Selection
      </button>
    </div>
    
    <div class="button-group">
      <button
        on:click={handleDecomposePolylines}
        disabled={!$drawingStore.drawing}
      >
        Decompose Polylines
      </button>
      
      <button
        on:click={handleJoinColinearLines}
        disabled={!$drawingStore.drawing}
      >
        Join Co-linear Lines
      </button>
      
      <button
        on:click={handleTranslateToPositive}
        disabled={!$drawingStore.drawing}
      >
        Translate to Positive
      </button>
    </div>
  </div>
  
  <div class="toolbar-right">
    {#if fileName}
      <span class="file-name">{fileName}</span>
    {/if}
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background-color: #f5f5f5;
    border-bottom: 1px solid #ddd;
  }
  
  .toolbar-left {
    display: flex;
    gap: 1rem;
  }
  
  .button-group {
    display: flex;
    gap: 0.5rem;
  }
  
  .toolbar-right {
    flex-shrink: 0;
  }
  
  .file-name {
    font-size: 0.9rem;
    color: #666;
    font-weight: 500;
  }
  
  button {
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    background-color: white;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover:not(:disabled) {
    background-color: #f0f0f0;
  }
  
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>