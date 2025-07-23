<script lang="ts">
  import FileImport from '../FileImport.svelte';
  import { workflowStore } from '../../lib/stores/workflow';

  function handleFileImported() {
    // Mark import stage as complete
    workflowStore.completeStage('import');
    // Auto-advance to edit stage after successful import
    setTimeout(() => {
      workflowStore.setStage('edit');
    }, 500);
  }
</script>

<div class="import-stage">
  <div class="import-container">
    <div class="import-header">
      <h1>Import Drawing</h1>
      <p class="import-description">
        Upload your DXF or SVG drawing file to begin the CAM workflow.
        Configure import options below to customize how your drawing is processed.
      </p>
    </div>

    <div class="import-content">
      <FileImport on:fileImported={handleFileImported} />
    </div>

    <div class="import-help">
      <h3>Supported File Formats</h3>
      <ul>
        <li><strong>DXF</strong> - AutoCAD Drawing Exchange Format with full support for polylines, bulges, and units</li>
        <li><strong>SVG</strong> - Scalable Vector Graphics with support for paths, shapes, and text</li>
      </ul>

      <h3>Import Options</h3>
      <ul>
        <li><strong>Decompose polylines</strong> - Convert complex polylines into individual line and arc segments for better CAM processing</li>
        <li><strong>Translate to positive quadrant</strong> - Move the drawing so all coordinates are positive, starting from (0,0)</li>
      </ul>
    </div>
  </div>
</div>

<style>
  .import-stage {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 2rem;
    min-height: 100%;
    background-color: #f9fafb;
  }

  .import-container {
    max-width: 800px;
    width: 100%;
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .import-header {
    padding: 2rem 2rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    text-align: center;
  }

  .import-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
  }

  .import-description {
    margin: 0;
    color: #6b7280;
    font-size: 1rem;
    line-height: 1.5;
  }

  .import-content {
    padding: 2rem;
  }

  .import-help {
    padding: 1.5rem 2rem;
    background-color: #f8f9fa;
    border-top: 1px solid #e5e7eb;
  }

  .import-help h3 {
    margin: 0 0 0.75rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #374151;
  }

  .import-help h3:not(:first-child) {
    margin-top: 1.5rem;
  }

  .import-help ul {
    margin: 0;
    padding-left: 1.5rem;
    color: #4b5563;
  }

  .import-help li {
    margin-bottom: 0.5rem;
    line-height: 1.5;
  }

  .import-help strong {
    color: #374151;
    font-weight: 600;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .import-stage {
      padding: 1rem;
    }

    .import-header {
      padding: 1.5rem 1.5rem 1rem;
    }

    .import-header h1 {
      font-size: 1.75rem;
    }

    .import-content {
      padding: 1.5rem;
    }

    .import-help {
      padding: 1.25rem 1.5rem;
    }
  }
</style>