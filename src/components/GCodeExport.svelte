<script lang="ts">
  import { pathsToToolPaths } from '../lib/cam/path-to-toolpath';
  import { generateGCode } from '../lib/cam/gcode-generator';
  import { drawingStore } from '../lib/stores/drawing';
  import { pathStore } from '../lib/stores/paths';
  import { chainStore } from '../lib/stores/chains';
  import type { CuttingParameters } from '../lib/types';
  import { onMount } from 'svelte';
  
  $: drawing = $drawingStore.drawing;
  $: paths = $pathStore.paths;
  $: chains = $chainStore.chains;
  
  let generatedGCode = '';
  let isGenerating = false;
  
  function handleGenerateGCode() {
    if (!drawing) {
      alert('Please import a drawing first');
      return;
    }
    
    if (paths.length === 0) {
      alert('No paths available. Please create operations first.');
      return;
    }
    
    isGenerating = true;
    generatedGCode = '';
    
    try {
      // Create a map of chain IDs to their shapes
      const chainShapes = new Map();
      chains.forEach(chain => {
        chainShapes.set(chain.id, chain.shapes);
      });
      
      // Convert paths to tool paths (uses offset geometry when available)
      const toolPaths = pathsToToolPaths(paths, chainShapes);
      
      // Generate G-code
      const gcode = generateGCode(toolPaths, drawing, {
        units: drawing.units,
        safeZ: 10,
        rapidFeedRate: 5000,
        includeComments: true,
        plasmaMode: true,
        materialNumber: 1, // Default material
        enableTHC: true,
        enableVelocityReduction: true
      });
      
      // Display the generated G-code
      generatedGCode = gcode;
    } catch (error) {
      console.error('Error generating G-code:', error);
      alert('Error generating G-code. Please check the console for details.');
    } finally {
      isGenerating = false;
    }
  }
  
  function downloadGCode() {
    if (!generatedGCode) return;
    
    const blob = new Blob([generatedGCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${$drawingStore.fileName?.replace(/\.[^/.]+$/, '') || 'output'}.ngc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  function copyToClipboard() {
    if (!generatedGCode) return;
    
    navigator.clipboard.writeText(generatedGCode).then(() => {
      alert('G-code copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy G-code:', err);
      alert('Failed to copy G-code to clipboard');
    });
  }
  
  // Automatically generate G-code when component mounts
  onMount(() => {
    handleGenerateGCode();
  });
</script>

<div class="export-container">
  {#if !generatedGCode && isGenerating}
    <div class="generate-section">
      <div class="generating-indicator">
        <div class="spinner"></div>
        <p>Generating G-code...</p>
      </div>
    </div>
  {:else if generatedGCode}
    <div class="gcode-section">
      <div class="gcode-header">
        <div class="gcode-info">
          <h4>Generated G-Code</h4>
          <span class="gcode-stats">
            {generatedGCode.split('\n').length} lines • {(new Blob([generatedGCode]).size / 1024).toFixed(2)} KB
          </span>
        </div>
        <div class="gcode-actions">
          <button class="action-button" on:click={copyToClipboard}>
            Copy to Clipboard
          </button>
          <button class="action-button download-button" on:click={downloadGCode}>
            Download
          </button>
          <button class="action-button regenerate-button" on:click={handleGenerateGCode}>
            Regenerate
          </button>
        </div>
      </div>
      
      <div class="gcode-content">
        <textarea
          class="gcode-textarea"
          value={generatedGCode}
          readonly
          spellcheck="false"
        ></textarea>
      </div>
    </div>
  {:else}
    <div class="generate-section">
      <div class="error-message">
        <p>No paths available. Please create operations first.</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .export-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: white;
  }
  
  /* Initial generate/loading view */
  .generate-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 2rem;
  }
  
  .generating-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  .generating-indicator p {
    margin: 0;
    color: #6b7280;
    font-size: 1rem;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  /* G-code display view */
  .gcode-section {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  
  .gcode-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background-color: #f8f9fa;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
  }
  
  .gcode-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .gcode-info h4 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
  }
  
  .gcode-stats {
    font-size: 0.875rem;
    color: #6b7280;
  }
  
  .gcode-actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .action-button {
    padding: 0.5rem 1rem;
    background-color: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s;
  }
  
  .action-button:hover {
    background-color: #f9fafb;
    border-color: #9ca3af;
  }
  
  .download-button {
    background-color: #3b82f6;
    color: white;
    border-color: #3b82f6;
  }
  
  .download-button:hover {
    background-color: #2563eb;
    border-color: #2563eb;
  }
  
  .regenerate-button {
    background-color: #10b981;
    color: white;
    border-color: #10b981;
  }
  
  .regenerate-button:hover:not(:disabled) {
    background-color: #059669;
    border-color: #059669;
  }
  
  .regenerate-button:disabled {
    background-color: #e5e7eb;
    border-color: #e5e7eb;
    color: #9ca3af;
    cursor: not-allowed;
  }
  
  /* G-code content area */
  .gcode-content {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  
  .gcode-textarea {
    flex: 1;
    width: 100%;
    height: 100%;
    padding: 1rem;
    border: none;
    background-color: #1e1e1e;
    color: #d4d4d4;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    resize: none;
    overflow: auto;
  }
  
  .gcode-textarea:focus {
    outline: none;
  }
  
  
  .error-message {
    text-align: center;
    color: #ef4444;
    font-size: 1rem;
  }
  
  .error-message p {
    margin: 0;
  }
</style>