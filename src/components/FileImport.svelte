<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { parseDXF } from '../lib/parsers/dxf-parser';
  import { drawingStore } from '../lib/stores/drawing';
  
  const dispatch = createEventDispatcher();
  
  let fileInput: HTMLInputElement;
  let isDragging = false;
  
  $: fileName = $drawingStore.fileName;
  
  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      
      try {
        let drawing;
        
        if (file.name.toLowerCase().endsWith('.dxf')) {
          drawing = await parseDXF(content);
        } else {
          alert('Unsupported file format. Please use DXF files.');
          return;
        }
        
        drawingStore.setDrawing(drawing, file.name);
        dispatch('fileImported', { drawing, fileName: file.name });
      } catch (error) {
        console.error('Error parsing file:', error);
        alert('Error parsing file. Please check the file format.');
      }
    };
    
    reader.readAsText(file);
  }
  
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    handleFiles(e.dataTransfer?.files || null);
  }
  
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }
  
  function handleDragLeave() {
    isDragging = false;
  }
</script>

<div
  class="file-import"
  class:dragging={isDragging}
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  role="region"
  aria-label="File import area"
>
  <input
    bind:this={fileInput}
    type="file"
    accept=".dxf"
    on:change={(e) => handleFiles(e.currentTarget.files)}
    style="display: none;"
  />
  
  <p class="import-description">
    Upload your DXF drawing file to begin the CAM workflow.
  </p>
  
  <button
    class="import-button"
    on:click={() => fileInput.click()}
  >
    Import DXF
  </button>
  
  
  {#if fileName}
    <p class="filename">Loaded: {fileName}</p>
  {:else}
    <p class="hint">or drag and drop a file here</p>
  {/if}
</div>

<style>
  .file-import {
    border: 2px dashed #ccc;
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    transition: all 0.3s ease;
  }
  
  .file-import.dragging {
    border-color: #0066cc;
    background-color: #f0f8ff;
  }
  
  .import-button {
    background-color: #0066cc;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }
  
  .import-button:hover {
    background-color: #0052a3;
  }
  
  .hint {
    margin-top: 1rem;
    color: #666;
  }
  
  .filename {
    margin-top: 1rem;
    color: #0066cc;
    font-weight: 500;
  }
  
  .import-description {
    margin: 0 0 1rem 0;
    color: #6b7280;
    font-size: 1rem;
    line-height: 1.5;
  }
  
</style>