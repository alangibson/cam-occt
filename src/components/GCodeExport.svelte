<script lang="ts">
  import { generateToolPaths } from '../lib/cam/path-generator';
  import { generateGCode } from '../lib/cam/gcode-generator';
  import { drawingStore } from '../lib/stores/drawing';
  import type { CuttingParameters } from '../types';
  
  export let parameters: CuttingParameters;
  
  $: drawing = $drawingStore.drawing;
  
  function handleGenerateGCode() {
    if (!drawing) {
      alert('Please import a drawing first');
      return;
    }
    
    try {
      // Generate tool paths
      const toolPaths = generateToolPaths(drawing, parameters);
      
      // Generate G-code
      const gcode = generateGCode(toolPaths, drawing, {
        units: drawing.units,
        safeZ: 10,
        rapidFeedRate: 5000,
        includeComments: true,
        plasmaMode: true
      });
      
      // Download file
      downloadGCode(gcode);
    } catch (error) {
      console.error('Error generating G-code:', error);
      alert('Error generating G-code. Please check the console for details.');
    }
  }
  
  function downloadGCode(gcode: string) {
    const blob = new Blob([gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.ngc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="export">
  <h3>Export G-Code</h3>
  
  <button
    class="export-button"
    on:click={handleGenerateGCode}
    disabled={!drawing}
  >
    Generate G-Code
  </button>
  
  <div class="info">
    {#if drawing}
      <p>Shapes: {drawing.shapes.length}</p>
      <p>Units: {drawing.units}</p>
    {:else}
      <p>No drawing loaded</p>
    {/if}
  </div>
</div>

<style>
  .export {
    padding: 1rem;
    background-color: #f9f9f9;
    border-radius: 4px;
  }
  
  h3 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .export-button {
    width: 100%;
    padding: 0.75rem;
    background-color: #28a745;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .export-button:hover:not(:disabled) {
    background-color: #218838;
  }
  
  .export-button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  
  .info {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #666;
  }
  
  .info p {
    margin: 0.25rem 0;
  }
</style>