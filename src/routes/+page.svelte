<script lang="ts">
  import WorkflowBreadcrumbs from '../components/WorkflowBreadcrumbs.svelte';
  import WorkflowContainer from '../components/WorkflowContainer.svelte';
  import Footer from '../components/Footer.svelte';
  import ToolTable from '../components/ToolTable.svelte';
  import { workflowStore } from '../lib/stores/workflow';
  import { uiStore } from '../lib/stores/ui';
</script>

<div class="app">
  <!-- Header -->
  <header class="app-header">
    <WorkflowBreadcrumbs />
    <button 
      class="tools-button" 
      onclick={() => $uiStore.showToolTable ? uiStore.hideToolTable() : uiStore.showToolTable()}
    >
      Tools
    </button>
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
    justify-content: space-between;
    align-items: center;
    padding: 0 1rem;
    background: #f8f9fa;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .tools-button {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .tools-button:hover {
    background: #2563eb;
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