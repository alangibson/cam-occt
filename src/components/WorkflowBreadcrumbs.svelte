<script lang="ts">
  import { workflowStore, getStageDisplayName, type WorkflowStage } from '../lib/stores/workflow';

  const stages: WorkflowStage[] = ['import', 'edit', 'program', 'simulate', 'export'];

  function handleStageClick(stage: WorkflowStage) {
    if ($workflowStore.canAdvanceTo(stage)) {
      workflowStore.setStage(stage);
    }
  }
</script>

<nav class="breadcrumbs" aria-label="Workflow stages">
  <ol class="breadcrumb-list">
    {#each stages as stage, index}
      <li class="breadcrumb-item">
        <button
          class="breadcrumb-button"
          class:current={$workflowStore.currentStage === stage}
          class:completed={$workflowStore.completedStages.has(stage)}
          class:accessible={$workflowStore.canAdvanceTo(stage)}
          class:inaccessible={!$workflowStore.canAdvanceTo(stage)}
          disabled={!$workflowStore.canAdvanceTo(stage)}
          on:click={() => handleStageClick(stage)}
          aria-current={$workflowStore.currentStage === stage ? 'step' : undefined}
        >
          <span class="stage-number">{index + 1}</span>
          <span class="stage-name">{getStageDisplayName(stage)}</span>
        </button>
        
        {#if index < stages.length - 1}
          <div class="breadcrumb-separator" aria-hidden="true">
            <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L6 6L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .breadcrumbs {
    background-color: #f8f9fa;
    border-bottom: 1px solid #e9ecef;
    padding: 1rem 2rem;
  }

  .breadcrumb-list {
    display: flex;
    align-items: center;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: 0.5rem;
  }

  .breadcrumb-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .breadcrumb-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: none;
    border: 2px solid transparent;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s ease;
    text-decoration: none;
  }

  .breadcrumb-button:hover:not(:disabled) {
    background-color: #f3f4f6;
    color: #374151;
  }

  .breadcrumb-button.accessible {
    color: #4f46e5;
    cursor: pointer;
  }

  .breadcrumb-button.accessible:hover {
    background-color: #eef2ff;
    border-color: #c7d2fe;
  }

  .breadcrumb-button.current {
    background-color: #4f46e5;
    color: white;
    border-color: #4f46e5;
    box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3), 0 2px 4px -1px rgba(79, 70, 229, 0.2);
    transform: scale(1.05);
  }

  .breadcrumb-button.completed {
    background-color: #10b981;
    color: white;
    border-color: #10b981;
  }

  .breadcrumb-button.completed:hover {
    background-color: #059669;
    border-color: #059669;
  }

  .breadcrumb-button.inaccessible {
    color: #9ca3af;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .breadcrumb-button:disabled {
    cursor: not-allowed;
  }

  .stage-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .breadcrumb-button.current .stage-number,
  .breadcrumb-button.completed .stage-number {
    background-color: rgba(255, 255, 255, 0.3);
  }

  .breadcrumb-button.inaccessible .stage-number {
    background-color: rgba(156, 163, 175, 0.2);
  }

  .stage-name {
    font-weight: 500;
  }

  .breadcrumb-separator {
    color: #d1d5db;
    margin: 0 0.25rem;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .breadcrumbs {
      padding: 0.75rem 1rem;
    }
    
    .stage-name {
      display: none;
    }
    
    .breadcrumb-button {
      padding: 0.5rem;
    }
  }
</style>