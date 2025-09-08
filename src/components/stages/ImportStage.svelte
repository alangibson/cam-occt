<script lang="ts">
    import FileImport from '../FileImport.svelte';
    import { workflowStore, WorkflowStage } from '../../lib/stores/workflow';
    import { clearChains } from '../../lib/stores/chains';
    import { clearParts } from '../../lib/stores/parts';
    import { overlayStore } from '../../lib/stores/overlay';
    import { tessellationStore } from '../../lib/stores/tessellation';

    function handleFileImported() {
        // Reset all application state when a new file is imported
        // This ensures clean state for the new drawing

        // Reset workflow state (except user settings)
        workflowStore.reset();

        // Clear all stage-specific data
        clearChains();
        clearParts();
        overlayStore.clearAllOverlays();
        tessellationStore.clearTessellation();

        // Mark import stage as complete
        workflowStore.completeStage(WorkflowStage.IMPORT);

        // Auto-advance to edit stage after successful import
        setTimeout(() => {
            workflowStore.setStage(WorkflowStage.EDIT);
        }, 500);
    }
</script>

<div class="import-stage">
    <div class="import-container">
        <div class="import-header">
            <h1>MetalHead CAM</h1>
        </div>

        <div class="import-content">
            <FileImport on:fileImported={handleFileImported} />
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

    .import-content {
        padding: 2rem;
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
    }
</style>
