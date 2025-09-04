<script lang="ts">
  import GCodeExport from '../GCodeExport.svelte';
  import AccordionPanel from '../AccordionPanel.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import type { CuttingParameters } from '../../lib/types';
  import { onMount } from 'svelte';

  // Resizable columns state
  let sideColumnWidth = 280; // Default width in pixels
  let isDraggingSide = false;
  let startX = 0;
  let startWidth = 0;

  // Default cutting parameters for G-code generation
  let cuttingParameters: CuttingParameters = {
    feedRate: 1000,
    pierceHeight: 3.8,
    pierceDelay: 0.5,
    cutHeight: 1.5,
    kerf: 1.5,
    leadInLength: 5,
    leadOutLength: 5
  };

  function handleStartOver() {
    workflowStore.reset();
    workflowStore.setStage('import');
  }

  // Auto-complete export stage
  workflowStore.completeStage('export');

  // Load column widths from localStorage on mount
  onMount(() => {
    const savedSideWidth = localStorage.getItem('metalheadcam-export-side-column-width');
    
    if (savedSideWidth) {
      sideColumnWidth = parseInt(savedSideWidth, 10);
    }
  });

  // Save column widths to localStorage
  function saveColumnWidths() {
    localStorage.setItem('metalheadcam-export-side-column-width', sideColumnWidth.toString());
  }

  // Side column resize handlers
  function handleSideResizeStart(e: MouseEvent) {
    isDraggingSide = true;
    startX = e.clientX;
    startWidth = sideColumnWidth;
    document.addEventListener('mousemove', handleSideResize);
    document.addEventListener('mouseup', handleSideResizeEnd);
    e.preventDefault();
  }

  function handleSideResize(e: MouseEvent) {
    if (!isDraggingSide) return;
    const deltaX = startX - e.clientX; // Reverse delta for right column
    const newWidth = Math.max(200, Math.min(600, startWidth + deltaX)); // Min 200px, max 600px
    sideColumnWidth = newWidth;
  }

  function handleSideResizeEnd() {
    isDraggingSide = false;
    document.removeEventListener('mousemove', handleSideResize);
    document.removeEventListener('mouseup', handleSideResizeEnd);
    saveColumnWidths();
  }

  // Keyboard support for resize handles
  function handleSideKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      sideColumnWidth = Math.min(600, sideColumnWidth + 10);
      saveColumnWidths();
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      sideColumnWidth = Math.max(200, sideColumnWidth - 10);
      saveColumnWidths();
      e.preventDefault();
    }
  }
</script>

<div class="export-stage">
  <div class="export-layout" class:no-select={isDraggingSide}>
    <!-- Main Content -->
    <div class="main-column">
      <GCodeExport />
    </div>

    <!-- Side Panel -->
    <div class="side-column" style="width: {sideColumnWidth}px;">
      <!-- Side resize handle -->
      <button 
        class="resize-handle resize-handle-left" 
        on:mousedown={handleSideResizeStart}
        on:keydown={handleSideKeydown}
        class:dragging={isDraggingSide}
        aria-label="Resize side panel (Arrow keys to adjust)"
        type="button"
      ></button>
      <AccordionPanel title="Export Summary" isExpanded={true}>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">Target Controller:</span>
            <span class="summary-value">LinuxCNC QtPlasmaC</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Output Format:</span>
            <span class="summary-value">G-code (.ngc)</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Drawing Units:</span>
            <span class="summary-value">Millimeters</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Cut Optimization:</span>
            <span class="summary-value">Enabled</span>
          </div>
        </div>
      </AccordionPanel>

      <AccordionPanel title="Start New Project" isExpanded={true}>
        <div class="workflow-content">
          <button 
            class="restart-button"
            on:click={handleStartOver}
          >
            Import New Drawing
          </button>
          <p class="restart-help">
            Start a new CAM workflow with a different drawing file.
          </p>
        </div>
      </AccordionPanel>
    </div>
  </div>
</div>

<style>
  .export-stage {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #f8f9fa;
  }

  .export-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .main-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: white;
    border-right: 1px solid #e5e7eb;
    padding: 0;
    overflow: hidden;
  }

  .side-column {
    background-color: #f5f5f5;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-shrink: 0; /* Prevent column from shrinking */
    position: relative; /* For resize handle positioning */
    flex-direction: column;
    gap: 1rem;
  }


  /* Removed .panel and .panel-title styles - now handled by AccordionPanel component */

  .workflow-content {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .summary-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
    border-bottom: 1px solid #f3f4f6;
  }

  .summary-item:last-child {
    border-bottom: none;
  }

  .summary-label {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .summary-value {
    color: #374151;
    font-weight: 600;
    font-size: 0.875rem;
  }


  /* Removed .workflow-panel styles - now handled by workflow-content within AccordionPanel */

  .restart-button {
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

  .restart-button:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .restart-help {
    margin: 0;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.4;
  }

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

  .resize-handle-left {
    left: -3px; /* Half of width to center on border */
  }

  /* Prevent text selection during resize */
  .export-layout.no-select {
    user-select: none;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .export-layout {
      flex-direction: column;
    }

    .side-column {
      width: 100% !important; /* Override dynamic width on mobile */
      height: auto;
      max-height: 300px;
    }

    /* Hide resize handles on mobile */
    .resize-handle {
      display: none;
    }

  }
</style>