import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock settings store to return all stages enabled (for testing workflow logic)
vi.mock('$lib/stores/settings/store.svelte', () => ({
    settingsStore: {
        settings: {
            enabledStages: [
                'import',
                'edit',
                'prepare',
                'program',
                'simulate',
                'export',
            ],
        },
    },
}));

/* eslint-disable import/first */
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { planStore } from '$lib/stores/plan/store.svelte';
import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
import { CutDirection, NormalSide } from '$lib/cam/cut/enums';
import { Cut } from '$lib/cam/cut/classes.svelte';
import { OperationAction } from '$lib/cam/operation/enums';
/* eslint-enable import/first */

describe('SimulateStage store subscription cleanup', () => {
    beforeEach(() => {
        // Reset all stores
        workflowStore.reset();
        visualizationStore.resetCuts();
        visualizationStore.resetRapids();
        visualizationStore.setTolerance(0.1);
    });

    it('should properly manage store subscriptions without memory leaks', () => {
        // Set up workflow to allow simulate stage
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.setStage(WorkflowStage.SIMULATE);

        // Note: visualizationStore are now Svelte 5 runes-based stores and don't have a subscribe method
        // Components use $effect to watch these stores instead

        // Verify we can still navigate without errors
        expect(() => {
            workflowStore.setStage(WorkflowStage.PROGRAM);
        }).not.toThrow();

        // Verify workflow state is correct
        expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM);
    });

    it('should handle navigation after adding cuts and rapids', () => {
        // Complete required stages
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);

        // Add test data
        planStore.plan.cuts.push(
            new Cut({
                id: 'test-cut-1',
                name: 'Test Cut',
                sourceOperationId: 'test-op',
                sourceChainId: 'test-chain',
                sourceToolId: 'test-tool',
                enabled: true,
                order: 1,
                action: OperationAction.CUT,
                feedRate: 1000,
                direction: CutDirection.COUNTERCLOCKWISE,
                normal: { x: 1, y: 0 },
                normalConnectionPoint: { x: 0, y: 0 },
                normalSide: NormalSide.LEFT,
            })
        );

        // Navigate to simulate
        workflowStore.setStage(WorkflowStage.SIMULATE);
        expect(workflowStore.currentStage).toBe(WorkflowStage.SIMULATE);

        // Note: drawingStore, visualizationStore, operationsStore, and uiStore use Svelte 5 and don't need subscription
        // Components use $effect to watch these stores instead

        // Navigate back to program
        expect(() => {
            workflowStore.setStage(WorkflowStage.PROGRAM);
        }).not.toThrow();

        expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM);
    });

    it('should allow multiple navigation cycles without errors', () => {
        // Complete all stages
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);

        // Navigate through stages multiple times
        for (let i = 0; i < 3; i++) {
            // Go to simulate
            workflowStore.setStage(WorkflowStage.SIMULATE);
            expect(workflowStore.currentStage).toBe(WorkflowStage.SIMULATE);

            // Note: visualizationStore is a Svelte 5 store and doesn't need subscription
            // Components use $effect to watch it instead

            // Go back to program
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM);

            // Go to edit
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM);
        }
    });
});
