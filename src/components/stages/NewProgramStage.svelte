<script lang="ts">
  import DrawingCanvas from '../DrawingCanvas.svelte';
  import Operations from '../Operations.svelte';
  import AccordionPanel from '../AccordionPanel.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import { drawingStore } from '../../lib/stores/drawing';
  import { chainStore, selectChain } from '../../lib/stores/chains';
  import { partStore, highlightPart, clearHighlight } from '../../lib/stores/parts';
  import { isChainClosed } from '../../lib/algorithms/part-detection';
  import { onMount } from 'svelte';
  
  // Subscribe to stores
  $: drawing = $drawingStore.drawing;
  $: chains = $chainStore.chains;
  $: parts = $partStore.parts;
  $: selectedChainId = $chainStore.selectedChainId;
  $: highlightedPartId = $partStore.highlightedPartId;

  // Resizable columns state
  let leftColumnWidth = 280; // Default width in pixels
  let rightColumnWidth = 280; // Default width in pixels
  let isDraggingLeft = false;
  let isDraggingRight = false;
  let startX = 0;
  let startWidth = 0;

  function handleNext() {
    workflowStore.completeStage('program');
    workflowStore.setStage('simulate');
  }

  // Chain selection functions
  function handleChainClick(chainId: string) {
    if (selectedChainId === chainId) {
      selectChain(null); // Deselect if already selected
    } else {
      selectChain(chainId);
    }
  }

  // Part highlighting functions  
  function handlePartClick(partId: string) {
    if (highlightedPartId === partId) {
      clearHighlight();
    } else {
      highlightPart(partId);
    }
  }

  // Helper function to check if a chain is closed
  function isChainClosedHelper(chain: any): boolean {
    return isChainClosed(chain, 0.1); // Use default tolerance since this is display-only
  }

  // Load column widths from localStorage on mount
  onMount(() => {
    const savedLeftWidth = localStorage.getItem('cam-occt-left-column-width');
    const savedRightWidth = localStorage.getItem('cam-occt-right-column-width');
    
    if (savedLeftWidth) {
      leftColumnWidth = parseInt(savedLeftWidth, 10);
    }
    if (savedRightWidth) {
      rightColumnWidth = parseInt(savedRightWidth, 10);
    }
  });

  // Save column widths to localStorage
  function saveColumnWidths() {
    localStorage.setItem('cam-occt-left-column-width', leftColumnWidth.toString());
    localStorage.setItem('cam-occt-right-column-width', rightColumnWidth.toString());
  }

  // Left column resize handlers
  function handleLeftResizeStart(e: MouseEvent) {
    isDraggingLeft = true;
    startX = e.clientX;
    startWidth = leftColumnWidth;
    document.addEventListener('mousemove', handleLeftResize);
    document.addEventListener('mouseup', handleLeftResizeEnd);
    e.preventDefault();
  }

  function handleLeftResize(e: MouseEvent) {
    if (!isDraggingLeft) return;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(600, startWidth + deltaX)); // Min 200px, max 600px
    leftColumnWidth = newWidth;
  }

  function handleLeftResizeEnd() {
    isDraggingLeft = false;
    document.removeEventListener('mousemove', handleLeftResize);
    document.removeEventListener('mouseup', handleLeftResizeEnd);
    saveColumnWidths();
  }

  // Right column resize handlers
  function handleRightResizeStart(e: MouseEvent) {
    isDraggingRight = true;
    startX = e.clientX;
    startWidth = rightColumnWidth;
    document.addEventListener('mousemove', handleRightResize);
    document.addEventListener('mouseup', handleRightResizeEnd);
    e.preventDefault();
  }

  function handleRightResize(e: MouseEvent) {
    if (!isDraggingRight) return;
    const deltaX = startX - e.clientX; // Reverse delta for right column
    const newWidth = Math.max(200, Math.min(600, startWidth + deltaX)); // Min 200px, max 600px
    rightColumnWidth = newWidth;
  }

  function handleRightResizeEnd() {
    isDraggingRight = false;
    document.removeEventListener('mousemove', handleRightResize);
    document.removeEventListener('mouseup', handleRightResizeEnd);
    saveColumnWidths();
  }

  // Keyboard support for resize handles
  function handleLeftKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      leftColumnWidth = Math.max(200, leftColumnWidth - 10);
      saveColumnWidths();
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      leftColumnWidth = Math.min(600, leftColumnWidth + 10);
      saveColumnWidths();
      e.preventDefault();
    }
  }

  function handleRightKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      rightColumnWidth = Math.min(600, rightColumnWidth + 10);
      saveColumnWidths();
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      rightColumnWidth = Math.max(200, rightColumnWidth - 10);
      saveColumnWidths();
      e.preventDefault();
    }
  }

  // Auto-complete program stage (user can adjust parameters and continue)
  workflowStore.completeStage('program');
</script>

<div class="program-stage">
  <div class="program-layout" class:no-select={isDraggingLeft || isDraggingRight}>
    <!-- Left Column - Parts and Paths -->
    <div class="left-column" style="width: {leftColumnWidth}px;">
      <!-- Left resize handle -->
      <button 
        class="resize-handle resize-handle-right" 
        on:mousedown={handleLeftResizeStart}
        on:keydown={handleLeftKeydown}
        class:dragging={isDraggingLeft}
        aria-label="Resize left panel (Arrow keys to adjust)"
        type="button"
      ></button>

      {#if chains.length > 0}
        <AccordionPanel title="Paths ({chains.length})" isExpanded={true}>
          <div class="path-list">
            {#each chains as chain (chain.id)}
              <div 
                class="path-item {selectedChainId === chain.id ? 'selected' : ''}"
                role="button"
                tabindex="0"
                on:click={() => handleChainClick(chain.id)}
                on:keydown={(e) => e.key === 'Enter' && handleChainClick(chain.id)}
              >
                <span class="path-name">Path {chain.id.split('-')[1]}</span>
                <span class="path-status {isChainClosedHelper(chain) ? 'closed' : 'open'}">
                  {isChainClosedHelper(chain) ? 'Closed' : 'Open'}
                </span>
              </div>
            {/each}
          </div>
        </AccordionPanel>
      {/if}

      {#if parts.length > 0}
        <AccordionPanel title="Parts ({parts.length})" isExpanded={true}>
          <div class="parts-list">
            {#each parts as part (part.id)}
              <div 
                class="part-item {highlightedPartId === part.id ? 'highlighted' : ''}"
                role="button"
                tabindex="0"
                on:click={() => handlePartClick(part.id)}
                on:keydown={(e) => e.key === 'Enter' && handlePartClick(part.id)}
              >
                <span class="part-name">Part {part.id.split('-')[1]}</span>
                <span class="part-info">{part.holes.length} holes</span>
              </div>
            {/each}
          </div>
        </AccordionPanel>
      {/if}

      <AccordionPanel title="Next Stage" isExpanded={true}>
        <div class="next-stage-content">
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
      </AccordionPanel>
    </div>

    <!-- Center Column - Drawing Canvas -->
    <div class="center-column">
      <div class="canvas-container">
        {#if drawing}
          <DrawingCanvas 
            treatChainsAsEntities={true}
            disableDragging={true}
            onChainClick={handleChainClick}
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

    <!-- Right Column - Operations -->
    <div class="right-column" style="width: {rightColumnWidth}px;">
      <!-- Right resize handle -->
      <button 
        class="resize-handle resize-handle-left" 
        on:mousedown={handleRightResizeStart}
        on:keydown={handleRightKeydown}
        class:dragging={isDraggingRight}
        aria-label="Resize right panel (Arrow keys to adjust)"
        type="button"
      ></button>
      <AccordionPanel title="Operations" isExpanded={true}>
        <Operations />
      </AccordionPanel>
      
      <AccordionPanel title="Path Information" isExpanded={true}>
        <div class="path-info">
          {#if selectedChainId}
            {@const selectedChain = chains.find(c => c.id === selectedChainId)}
            {#if selectedChain}
              <div class="info-item">
                <span class="info-label">Selected Path:</span>
                <span class="info-value">Path {selectedChain.id.split('-')[1]}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status:</span>
                <span class="info-value">{isChainClosedHelper(selectedChain) ? 'Closed' : 'Open'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Shapes:</span>
                <span class="info-value">{selectedChain.shapes.length}</span>
              </div>
            {/if}
          {:else}
            <div class="info-item">
              <span class="info-label">Total Paths:</span>
              <span class="info-value">{chains.length}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Total Parts:</span>
              <span class="info-value">{parts.length}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Instructions:</span>
              <span class="info-value">Select a path to view details</span>
            </div>
          {/if}
        </div>
      </AccordionPanel>
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
    background-color: #f5f5f5;
    border-right: 1px solid #e5e7eb;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0; /* Allow flex child to shrink */
    flex-shrink: 0; /* Prevent column from shrinking */
    position: relative; /* For resize handle positioning */
  }

  .center-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: white;
  }

  .right-column {
    background-color: #f5f5f5;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0; /* Allow flex child to shrink */
    flex-shrink: 0; /* Prevent column from shrinking */
    position: relative; /* For resize handle positioning */
  }

  /* Removed .panel styles - now handled by AccordionPanel component */


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

  /* .parts-list has no special styling - shows all parts without scrollbar */
  
  /* .path-list has no special styling - shows all paths without scrollbar */

  .path-item, .part-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    margin: 0.25rem 0;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .path-item:hover, .part-item:hover {
    background-color: #f3f4f6;
  }

  .path-item.selected {
    background-color: #dbeafe;
    border-color: #3b82f6;
  }

  .part-item.highlighted {
    background-color: #fef3c7;
    border-color: #f59e0b;
  }

  .path-name, .part-name {
    font-weight: 500;
    color: #374151;
  }

  .path-info, .part-info {
    color: #6b7280;
    font-size: 0.75rem;
  }

  .path-status {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-weight: 500;
  }

  .path-status.closed {
    background-color: #dcfce7;
    color: #166534;
  }

  .path-status.open {
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

  .next-stage-content {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    border-radius: 0.5rem;
    padding: 1rem;
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

  /* Removed .panel-title styles - now handled by AccordionPanel component */

  /* Resize handle styles */
  .resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    background: transparent;
    border: none;
    padding: 0;
    z-index: 10;
    transition: background-color 0.2s ease;
  }

  .resize-handle:hover {
    background-color: #3b82f6;
    opacity: 0.3;
  }

  .resize-handle.dragging {
    background-color: #3b82f6;
    opacity: 0.5;
  }

  .resize-handle-right {
    right: -3px; /* Half of width to center on border */
  }

  .resize-handle-left {
    left: -3px; /* Half of width to center on border */
  }

  /* Prevent text selection during resize */
  .program-layout.no-select {
    user-select: none;
  }


</style>