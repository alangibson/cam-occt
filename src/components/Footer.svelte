<script lang="ts">
  import { onMount } from 'svelte';
  import { drawingStore } from '../lib/stores/drawing';
  import { calculateDrawingSize, type DrawingSize } from '../lib/algorithms/drawing-size/drawing-size';
  
  $: drawing = $drawingStore.drawing;
  $: scale = $drawingStore.scale;
  let drawingSize: DrawingSize | null = null;
  let isCalculating = false;
  
  // Recalculate size when drawing changes
  $: if (drawing) {
    calculateSize();
  } else {
    drawingSize = null;
  }
  
  async function calculateSize() {
    if (!drawing || isCalculating) return;
    
    isCalculating = true;
    try {
      drawingSize = await calculateDrawingSize(drawing);
    } catch (error) {
      console.error('Error calculating drawing size:', error);
      drawingSize = null;
    } finally {
      isCalculating = false;
    }
  }
  
  function formatSize(size: number, units: string): string {
    return `${size.toFixed(2)} ${units}`;
  }
  
  function formatZoom(scale: number): string {
    return `${(scale * 100).toFixed(0)}%`;
  }
</script>

<footer class="footer">
  <div class="drawing-info">
    {#if isCalculating}
      <span class="calculating">Calculating size...</span>
    {:else if drawingSize}
      <span class="size-info">
        Size: {formatSize(drawingSize.width, drawingSize.units)} × {formatSize(drawingSize.height, drawingSize.units)}
        {#if drawingSize.source === 'calculated'}
          <span class="source-note">(calculated)</span>
        {/if}
      </span>
    {:else if drawing}
      <span class="no-size">Unable to calculate size</span>
    {:else}
      <span class="no-drawing">No drawing loaded</span>
    {/if}
    
    <span class="zoom-info">Zoom: {formatZoom(scale)}</span>
  </div>
</footer>

<style>
  .footer {
    background-color: #f5f5f5;
    border-top: 1px solid #ddd;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    color: #666;
  }
  
  .drawing-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .size-info {
    font-family: 'Courier New', monospace;
    font-weight: 500;
  }
  
  .source-note {
    font-size: 0.8rem;
    opacity: 0.7;
    margin-left: 0.5rem;
  }
  
  .calculating {
    color: #007acc;
    font-style: italic;
  }
  
  .no-size {
    color: #cc6600;
  }
  
  .no-drawing {
    color: #999;
  }
  
  .zoom-info {
    font-family: 'Courier New', monospace;
    font-weight: 500;
    color: #333;
  }
</style>