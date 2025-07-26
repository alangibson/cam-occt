<script lang="ts">
  import { drawingStore } from '../lib/stores/drawing';
  
  $: drawing = $drawingStore.drawing;
  
  // Get unique layers from shapes
  $: layers = drawing ? getUniqueLayers(drawing.shapes) : [];
  
  function getUniqueLayers(shapes: any[]): { name: string; shapeCount: number }[] {
    const layerSet = new Set<string>();
    
    shapes.forEach(shape => {
      // Treat empty, null, or whitespace-only layers as '0' (default layer)
      const layerName = shape.layer && shape.layer.trim() !== '' ? shape.layer : '0';
      layerSet.add(layerName);
    });
    
    // Convert to array and sort, with default layer '0' first
    const layerArray = Array.from(layerSet).sort((a, b) => {
      if (a === '0') return -1;
      if (b === '0') return 1;
      return a.localeCompare(b);
    });
    
    return layerArray.map(layerName => ({
      name: layerName,
      shapeCount: shapes.filter(shape => {
        const shapeLayer = shape.layer && shape.layer.trim() !== '' ? shape.layer : '0';
        return shapeLayer === layerName;
      }).length
    }));
  }
</script>

<div class="layers-info">
  {#if drawing && layers.length > 0}
    <div class="layers">
      {#each layers as layer}
        <div class="layer-item">
          <div class="layer-info">
            <span class="layer-name">
              {layer.name === '0' ? 'Default Layer' : layer.name}
            </span>
            <span class="shape-count">{layer.shapeCount} shapes</span>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="no-layers">No layers found</p>
  {/if}
</div>

<style>
  .layers-info {
    padding: 0;
  }
  
  /* h3 header removed - title now handled by AccordionPanel */
  
  .layers {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .layer-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    background-color: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
  }
  
  .layer-info {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  
  .layer-name {
    font-weight: 500;
    color: #374151;
    font-size: 0.875rem;
  }
  
  .shape-count {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.125rem;
  }
  
  .no-layers {
    color: #6b7280;
    font-style: italic;
    font-size: 0.875rem;
    margin: 0;
  }
</style>