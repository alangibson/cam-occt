<script lang="ts">
  import { workflowStore } from '../../lib/stores/workflow';

  function handleNext() {
    workflowStore.completeStage('simulate');
    workflowStore.setStage('export');
  }

  // Auto-complete simulate stage (placeholder functionality)
  workflowStore.completeStage('simulate');
</script>

<div class="simulate-stage">
  <div class="simulate-layout">
    <!-- Center Column - 3D Simulation Viewport -->
    <div class="center-column">
      <div class="simulation-header">
        <h2>3D Cutting Simulation</h2>
        <div class="simulation-controls">
          <button class="control-btn" disabled>
            <span>▶️</span> Play
          </button>
          <button class="control-btn" disabled>
            <span>⏸️</span> Pause
          </button>
          <button class="control-btn" disabled>
            <span>⏹️</span> Stop  
          </button>
          <button class="control-btn" disabled>
            <span>⏮️</span> Reset
          </button>
        </div>
      </div>

      <div class="simulation-viewport">
        <div class="placeholder-3d">
          <div class="placeholder-icon">🔧</div>
          <h3>3D Simulation Viewport</h3>
          <p>
            This area will display a real-time 3D simulation of the cutting process.
            The simulation will show:
          </p>
          <ul>
            <li>Tool path execution in real-time</li>
            <li>Torch pierce and cut operations</li>
            <li>Material removal visualization</li>
            <li>Cut timing and sequence</li>
          </ul>
          <p class="tech-note">
            <strong>Implementation:</strong> Will use Three.js for 3D rendering and physics simulation.
          </p>
        </div>
      </div>

      <div class="simulation-progress">
        <div class="progress-info">
          <span>Progress: <strong>0%</strong></span>
          <span>Time: <strong>00:00 / 00:00</strong></span>
          <span>Current Operation: <strong>Ready</strong></span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: 0%"></div>
        </div>
      </div>
    </div>

    <!-- Right Column - Simulation Stats and Controls -->
    <div class="right-column">
      <div class="panel">
        <h3 class="panel-title">Simulation Settings</h3>
        <div class="setting-group">
          <label>
            <input type="checkbox" checked disabled>
            Show tool path
          </label>
          <label>
            <input type="checkbox" checked disabled>
            Show pierce points
          </label>
          <label>
            <input type="checkbox" disabled>
            Show lead-in/out
          </label>
          <label>
            <input type="checkbox" disabled>
            Realistic timing
          </label>
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Cut Statistics</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Length:</span>
            <span class="stat-value">-- mm</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Cut Time:</span>
            <span class="stat-value">-- min</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Pierce Count:</span>
            <span class="stat-value">--</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Rapid Distance:</span>
            <span class="stat-value">-- mm</span>
          </div>
        </div>
      </div>

      <div class="panel next-stage-panel">
        <button 
          class="next-button"
          on:click={handleNext}
        >
          Next: Export G-code
        </button>
        <p class="next-help">
          Simulation complete! Ready to generate and export G-code.
        </p>
      </div>
    </div>
  </div>
</div>

<style>
  .simulate-stage {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #1a1a1a;
    color: white;
  }

  .simulate-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .center-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: #2d2d2d;
  }

  .right-column {
    width: 280px;
    background-color: #1f1f1f;
    border-left: 1px solid #404040;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .simulation-header {
    padding: 1rem 2rem;
    border-bottom: 1px solid #404040;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #252525;
  }

  .simulation-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
  }

  .simulation-controls {
    display: flex;
    gap: 0.5rem;
  }

  .control-btn {
    padding: 0.5rem 1rem;
    background: #404040;
    color: white;
    border: 1px solid #555;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .control-btn:hover:not(:disabled) {
    background: #505050;
    border-color: #666;
  }

  .control-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .simulation-viewport {
    flex: 1;
    background: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .placeholder-3d {
    text-align: center;
    max-width: 600px;
    color: #ccc;
  }

  .placeholder-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .placeholder-3d h3 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
    color: white;
  }

  .placeholder-3d p {
    margin: 0 0 1rem 0;
    line-height: 1.6;
    color: #aaa;
  }

  .placeholder-3d ul {
    text-align: left;
    margin: 1rem 0;
    padding-left: 1.5rem;
    color: #aaa;
  }

  .placeholder-3d li {
    margin-bottom: 0.5rem;
  }

  .tech-note {
    font-style: italic;
    color: #888 !important;
    font-size: 0.875rem;
  }

  .simulation-progress {
    padding: 1rem 2rem;
    border-top: 1px solid #404040;
    background-color: #252525;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: #ccc;
  }

  .progress-bar {
    height: 4px;
    background: #404040;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #059669);
    transition: width 0.3s ease;
  }

  .panel {
    background: #2d2d2d;
    border: 1px solid #404040;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .panel-title {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: white;
    border-bottom: 1px solid #404040;
    padding-bottom: 0.5rem;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .setting-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ccc;
    cursor: pointer;
  }

  .setting-group input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
  }

  .stats-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #404040;
  }

  .stat-item:last-child {
    border-bottom: none;
  }

  .stat-label {
    color: #aaa;
  }

  .stat-value {
    color: white;
    font-weight: 600;
  }

  .next-stage-panel {
    margin-top: auto;
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border: none;
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
</style>