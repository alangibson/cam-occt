<script lang="ts">
  import WorkflowBreadcrumbs from '../components/WorkflowBreadcrumbs.svelte';
  import WorkflowContainer from '../components/WorkflowContainer.svelte';
  import Footer from '../components/Footer.svelte';
  import { workflowStore } from '../lib/stores/workflow';
</script>

<div class="app">
  <!-- Header -->
  <header class="app-header">
    <WorkflowBreadcrumbs />
  </header>

  <!-- Body -->
  <main class="app-body">
    <WorkflowContainer />
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