<script lang="ts">
  import { onMount } from 'svelte';
  import WorkflowBreadcrumbs from '../components/WorkflowBreadcrumbs.svelte';
  import WorkflowContainer from '../components/WorkflowContainer.svelte';
  import Footer from '../components/Footer.svelte';
  import ToolTable from '../components/ToolTable.svelte';
  import { workflowStore } from '../lib/stores/workflow';
  import { uiStore } from '../lib/stores/ui';
  import { drawingStore } from '../lib/stores/drawing';
  import { 
    restoreApplicationState, 
    setupAutoSave,
    saveApplicationState,
    clearApplicationState 
  } from '../lib/stores/persistence';
  import { migrateLegacyData } from '../lib/utils/migration';
  import { prepareStageStore } from '../lib/stores/prepare-stage';
  import { leadWarningsStore } from '../lib/stores/lead-warnings';
  import { offsetWarningsStore } from '../lib/stores/offset-warnings';
  
  let cleanupAutoSave: (() => void) | null = null;
  let isMenuOpen = false;
  
  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
  }
  
  function closeMenu() {
    isMenuOpen = false;
  }
  
  function clearDrawingState() {
    closeMenu();
    // Reset drawing store to empty state (this also clears chains, parts, paths, operations, rapids, tessellation, overlay)
    drawingStore.setDrawing({
      shapes: [],
      bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
      units: 'mm',
      layers: {}
    });
    
    // Clear additional stores that aren't cleared by setDrawing
    prepareStageStore.reset();
    leadWarningsStore.clearAllWarnings();
    offsetWarningsStore.clearAllWarnings();
    
    // Reset workflow to import stage
    workflowStore.reset();
    
    // Clear persisted state from localStorage
    clearApplicationState();
  }
  
  onMount(() => {
    // Migrate any legacy localStorage data
    migrateLegacyData();
    
    // Restore state from localStorage on app load
    const restored = restoreApplicationState();
    if (restored) {
      console.log('Application state restored from previous session');
    }
    
    // Setup auto-save for all state changes
    cleanupAutoSave = setupAutoSave();
    
    // Save state when page is about to unload
    const handleBeforeUnload = () => {
      saveApplicationState();
    };
    
    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen && !(event.target as Element)?.closest('.hamburger-container')) {
        closeMenu();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClickOutside);
    
    // Cleanup function
    return () => {
      if (cleanupAutoSave) {
        cleanupAutoSave();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="app">
  <!-- Header -->
  <header class="app-header">
    <!-- Hamburger Menu -->
    <div class="hamburger-container">
      <button class="hamburger-button" onclick={toggleMenu} aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      
      {#if isMenuOpen}
        <div class="menu-dropdown">
          <button 
            class="menu-item clear-menu-item" 
            onclick={() => clearDrawingState()}
          >
            Clear
          </button>
          <button 
            class="menu-item tools-menu-item" 
            onclick={() => {
              closeMenu();
              $uiStore.showToolTable ? uiStore.hideToolTable() : uiStore.showToolTable();
            }}
          >
            Tools
          </button>
        </div>
      {/if}
    </div>
    
    <WorkflowBreadcrumbs />
  </header>

  <!-- Body -->
  <main class="app-body">
    {#if $uiStore.showToolTable}
      <ToolTable />
    {:else}
      <WorkflowContainer />
    {/if}
  </main>

  <!-- Footer -->
  <footer class="app-footer">
    <Footer />
  </footer>
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
  
  .app-header {
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 0.5rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e5e7eb;
    position: relative;
  }
  
  .hamburger-container {
    position: absolute;
    left: 0.5rem;
  }
  
  .hamburger-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background: none;
    border: none;
    border-radius: 0.375rem;
    color: #4b5563;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .hamburger-button:hover {
    background: #f3f4f6;
  }
  
  .menu-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.25rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    min-width: 120px;
    z-index: 1000;
    padding: 0.75rem 1rem;
  }
  
  .menu-item {
    display: block;
    width: 100%;
    padding: 0.5rem 0.5rem;
    background: none;
    border: none;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    border-radius: 0.25rem;
    margin: 0.25rem 0;
  }
  
  
  .clear-menu-item {
    color: #dc2626;
  }
  
  .clear-menu-item:hover {
    background: #fef2f2;
    color: #b91c1c;
  }
  
  .tools-menu-item {
    color: #2563eb;
  }
  
  .tools-menu-item:hover {
    background: #eff6ff;
    color: #1d4ed8;
  }
  
  .app-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .app-footer {
    flex-shrink: 0;
  }
</style>