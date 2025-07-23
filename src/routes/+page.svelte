<script lang="ts">
  import FileImport from '../components/FileImport.svelte';
  import DrawingCanvas from '../components/DrawingCanvas.svelte';
  import ToolBar from '../components/ToolBar.svelte';
  import CuttingParameters from '../components/CuttingParameters.svelte';
  import GCodeExport from '../components/GCodeExport.svelte';
  import Footer from '../components/Footer.svelte';
  import type { CuttingParameters as CuttingParametersType } from '../types';
  
  let cuttingParameters: CuttingParametersType = {
    feedRate: 1000,
    pierceHeight: 3.8,
    pierceDelay: 0.5,
    cutHeight: 1.5,
    kerf: 1.5,
    leadInLength: 5,
    leadOutLength: 5
  };
</script>

<div class="app">
  <div class="main-content">
    <div class="sidebar">
      <FileImport />
      
      <div class="parameters-section">
        <CuttingParameters bind:parameters={cuttingParameters} units="mm" />
      </div>
      
      <div class="export-section">
        <GCodeExport parameters={cuttingParameters} />
      </div>
    </div>
    
    <div class="workspace">
      <ToolBar />
      <div class="canvas-container">
        <DrawingCanvas />
      </div>
      <Footer />
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  
  
  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  
  .sidebar {
    width: 300px;
    background-color: #f5f5f5;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .workspace {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  .canvas-container {
    flex: 1;
    position: relative;
    background-color: #fff;
  }
  
  .parameters-section,
  .export-section {
    margin-top: 1rem;
  }
</style>