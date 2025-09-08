<script lang="ts">
    import {
        workflowStore,
        getStageDisplayName,
        WorkflowStage,
        type WorkflowStage as WorkflowStageType,
    } from '../lib/stores/workflow';
    import { uiStore } from '../lib/stores/ui';

    const stages: WorkflowStageType[] = [
        WorkflowStage.IMPORT,
        WorkflowStage.EDIT,
        WorkflowStage.PREPARE,
        WorkflowStage.PROGRAM,
        WorkflowStage.SIMULATE,
        WorkflowStage.EXPORT,
    ];

    function handleStageClick(stage: WorkflowStageType) {
        if ($workflowStore.canAdvanceTo(stage)) {
            // Hide tool table when navigating to a stage
            uiStore.hideToolTable();
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
                    aria-current={$workflowStore.currentStage === stage
                        ? 'step'
                        : undefined}
                >
                    <span class="stage-name">{getStageDisplayName(stage)}</span>
                </button>

                {#if index < stages.length - 1}
                    <div class="breadcrumb-separator" aria-hidden="true">
                        <svg
                            width="8"
                            height="12"
                            viewBox="0 0 8 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M1 1L6 6L1 11"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
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
        color: rgb(0, 83, 135);
        cursor: pointer;
    }

    .breadcrumb-button.accessible:hover {
        background-color: #e6f2ff;
        border-color: #c7d2fe;
    }

    .breadcrumb-button.completed {
        background-color: rgb(0, 133, 84);
        color: white;
        border-color: rgb(0, 133, 84);
    }

    .breadcrumb-button.completed:hover {
        background-color: rgb(0, 133, 84);
        border-color: rgb(0, 133, 84);
    }

    /* Current stage always takes precedence over completed */
    .breadcrumb-button.current {
        background-color: rgb(0, 83, 135) !important;
        color: white;
        border-color: rgb(0, 83, 135) !important;
        box-shadow:
            0 4px 6px -1px rgba(0, 83, 135, 0.3),
            0 2px 4px -1px rgba(0, 83, 135, 0.2);
        transform: scale(1.05);
    }

    .breadcrumb-button.current:hover {
        background-color: rgb(0, 83, 135) !important;
        border-color: rgb(0, 83, 135) !important;
    }

    .breadcrumb-button.inaccessible {
        color: #9ca3af;
        cursor: not-allowed;
        opacity: 0.6;
    }

    .breadcrumb-button:disabled {
        cursor: not-allowed;
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
            padding: 0.5rem 0.75rem;
        }
    }
</style>
