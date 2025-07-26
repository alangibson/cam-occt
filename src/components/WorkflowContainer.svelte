<script lang="ts">
  import { workflowStore } from '../lib/stores/workflow';
  import ImportStage from './stages/ImportStage.svelte';
  import EditStage from './stages/EditStage.svelte';
  import PrepareStage from './stages/PrepareStage.svelte';
  import ProgramStage from './stages/NewProgramStage.svelte';
  import SimulateStage from './stages/SimulateStage.svelte';
  import ExportStage from './stages/ExportStage.svelte';
</script>

<div class="workflow-container">
  {#if $workflowStore.currentStage === 'import'}
    <ImportStage />
  {:else if $workflowStore.currentStage === 'edit'}
    <EditStage />
  {:else if $workflowStore.currentStage === 'prepare'}
    <PrepareStage />
  {:else if $workflowStore.currentStage === 'program'}
    <ProgramStage />
  {:else if $workflowStore.currentStage === 'simulate'}
    <SimulateStage />
  {:else if $workflowStore.currentStage === 'export'}
    <ExportStage />
  {/if}
</div>

<style>
  .workflow-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>