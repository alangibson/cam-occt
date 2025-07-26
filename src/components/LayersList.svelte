<script lang="ts">
  import { drawingStore } from '../lib/stores/drawing';
  
  $: drawing = $drawingStore.drawing;
  
  // Track layer visibility state
  let layerVisibility: { [layerName: string]: boolean } = {};
  
  // Get unique layers from shapes
  $: layers = drawing ? getUniqueLayers(drawing.shapes) : [];
  
  // Initialize visibility for new layers
  $: {
    layers.forEach(layer => {
      if (!(layer.name in layerVisibility)) {
        layerVisibility[layer.name] = true; // Default to visible
      }
    });
  }
  
  function toggleLayerVisibility(layerName: string) {
    layerVisibility[layerName] = !layerVisibility[layerName];
    // Force reactivity update
    layerVisibility = { ...layerVisibility };
    
    // Update the drawing store to hide/show shapes
    if (drawing) {
      drawingStore.setLayerVisibility(layerName, layerVisibility[layerName]);
    }
  }
  
  function getUniqueLayers(shapes: any[]) {
    const layerSet = new Set<string>();
    shapes.forEach(shape => {
      if (shape.layer && shape.layer.trim() !== '') {
        layerSet.add(shape.layer);
      } else {
        layerSet.add('0'); // Default layer
      }
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

<div class="layers-list">
  {#if drawing && layers.length > 0}
    <div class="layers">
      {#each layers as layer}
        <div class="layer-item">
          <button 
            class="visibility-toggle"
            class:visible={layerVisibility[layer.name]}
            on:click={() => toggleLayerVisibility(layer.name)}
            title={layerVisibility[layer.name] ? 'Hide layer' : 'Show layer'}
          >
            {layerVisibility[layer.name] ? '👁️' : '👁️‍🗨️'}
          </button>
          <span class="layer-name">{layer.name}</span>
          <span class="layer-count">{layer.shapeCount} shapes</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="no-layers">No drawing loaded</p>
  {/if}
</div>

<style>
  .layers-list {
    padding: 1rem;
    background-color: #f9f9f9;
    border-radius: 4px;
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
    gap: 0.5rem;
    padding: 0.5rem;
    background-color: #fff;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
  
  .visibility-toggle {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
  }
  
  .visibility-toggle:hover {
    background-color: #f0f0f0;
  }
  
  .visibility-toggle.visible {
    opacity: 1;
  }
  
  .visibility-toggle:not(.visible) {
    opacity: 0.5;
  }
  
  .layer-name {
    font-weight: 500;
    color: #333;
    flex: 1;
  }
  
  .layer-count {
    font-size: 0.9rem;
    color: #666;
  }
  
  .no-layers {
    color: #666;
    font-style: italic;
    margin: 0;
  }
</style>