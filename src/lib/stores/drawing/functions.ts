/**
 * Drawing Store Helper Functions
 *
 * Helper functions that work with drawing data but don't directly modify the store.
 */

import { WorkflowStage } from '$lib/stores/workflow/enums';
import { partStore } from '$lib/stores/parts/store.svelte';
import { overlayStore } from '$lib/stores/overlay/store.svelte';
import { tessellationStore } from '$lib/stores/tessellation/store.svelte';
import { cutStore } from '$lib/stores/cuts/store.svelte';
import { operationsStore } from '$lib/stores/operations/store.svelte';
import { rapidStore } from '$lib/stores/rapids/store.svelte';
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { planStore } from '$lib/stores/plan/store.svelte';

/**
 * Helper function to reset downstream stages when drawing is modified
 */
export const resetDownstreamStages = (
    fromStage: WorkflowStage = WorkflowStage.IMPORT
): void => {
    // Clear stage-specific data
    // Chains are auto-generated from drawing layers, no need to clear them
    partStore.clearParts();

    // Clear other stores
    overlayStore.clearStageOverlay(WorkflowStage.PROGRAM);
    overlayStore.clearStageOverlay(WorkflowStage.SIMULATE);
    overlayStore.clearStageOverlay(WorkflowStage.EXPORT);
    tessellationStore.clearTessellation();

    // Clear program-specific stores
    cutStore.reset();
    operationsStore.reset();
    rapidStore.reset();
    planStore.reset();

    // Reset workflow completion status for downstream stages
    workflowStore.invalidateDownstreamStages(fromStage);
};
