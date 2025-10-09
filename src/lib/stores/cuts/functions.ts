/**
 * Cut Store Helper Functions
 *
 * Helper functions that work with cut data but don't directly modify the store.
 */

import { workflowStore } from '$lib/stores/workflow/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import type { Cut } from './interfaces';

/**
 * Helper function to check if program stage should be completed
 */
export function checkProgramStageCompletion(cuts: Cut[]) {
    if (cuts.length > 0) {
        workflowStore.completeStage(WorkflowStage.PROGRAM);
    } else {
        // If no cuts exist, invalidate stages after WorkflowStage.PREPARE
        workflowStore.invalidateDownstreamStages(WorkflowStage.PREPARE);
    }
}
