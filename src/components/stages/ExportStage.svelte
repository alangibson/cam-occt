<script lang="ts">
  import GCodeExport from '../GCodeExport.svelte';
  import AccordionPanel from '../AccordionPanel.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import type { CuttingParameters } from '../../types';

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
</script>

<div class="export-stage">
  <div class="export-layout">
    <!-- Main Content -->
    <div class="main-column">
      <GCodeExport parameters={cuttingParameters} />
    </div>

    <!-- Side Panel -->
    <div class="side-column">
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

      <AccordionPanel title="G-code Features" isExpanded={true}>
        <ul class="feature-list">
          <li>✅ Torch height control (THC) commands</li>
          <li>✅ Automatic pierce delay</li>
          <li>✅ Lead-in and lead-out paths</li>
          <li>✅ Optimized cut sequencing</li>
          <li>✅ Rapid traverse movements</li>
          <li>✅ Proper coordinate system</li>
        </ul>
      </AccordionPanel>

      <AccordionPanel title="Safety Reminders" isExpanded={true}>
        <div class="safety-warnings">
          <div class="warning-item">
            <span class="warning-icon">⚠️</span>
            <span>Always verify G-code in a simulator before cutting</span>
          </div>
          <div class="warning-item">
            <span class="warning-icon">🔍</span>
            <span>Check material thickness and cutting parameters</span>
          </div>
          <div class="warning-item">
            <span class="warning-icon">🛡️</span>
            <span>Ensure proper safety equipment is in place</span>
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
    width: 320px;
    background-color: #f5f5f5;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
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

  .feature-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .feature-list li {
    padding: 0.5rem 0;
    color: #4b5563;
    font-size: 0.875rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .feature-list li:last-child {
    border-bottom: none;
  }

  .safety-warnings {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .warning-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    color: #92400e;
  }

  .warning-icon {
    flex-shrink: 0;
    font-size: 1rem;
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

  /* Responsive design */
  @media (max-width: 1200px) {
    .side-column {
      width: 280px;
    }
  }

  @media (max-width: 768px) {
    .export-layout {
      flex-direction: column;
    }

    .side-column {
      width: 100%;
      height: auto;
      max-height: 300px;
    }

  }
</style>