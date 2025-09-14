/**
 * Path Store Helper Functions
 *
 * Helper functions that work with path data but don't directly modify the store.
 */

import { workflowStore } from '$lib/stores/workflow/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import type { Path } from './interfaces';

/**
 * Helper function to check if program stage should be completed
 */
export function checkProgramStageCompletion(paths: Path[]) {
    if (paths.length > 0) {
        workflowStore.completeStage(WorkflowStage.PROGRAM);
    } else {
        // If no paths exist, invalidate stages after WorkflowStage.PREPARE
        workflowStore.invalidateDownstreamStages(WorkflowStage.PREPARE);
    }
}
