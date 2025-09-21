import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { workflowStore } from '$lib/stores/workflow/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { pathStore } from '$lib/stores/paths/store';
import { rapidStore } from '$lib/stores/rapids/store';
import { chainStore } from '$lib/stores/chains/store';
import { operationsStore } from '$lib/stores/operations/store';
import { drawingStore } from '$lib/stores/drawing/store';
import { uiStore } from '$lib/stores/ui/store';
import { CutDirection } from '$lib/types/direction';

describe('SimulateStage store subscription cleanup', () => {
    beforeEach(() => {
        // Reset all stores
        workflowStore.reset();
        pathStore.reset();
        rapidStore.reset();
        chainStore.clearChains();
        chainStore.setTolerance(0.1);
    });

    it('should properly manage store subscriptions without memory leaks', () => {
        // Set up workflow to allow simulate stage
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.completeStage(WorkflowStage.EDIT);
        workflowStore.completeStage(WorkflowStage.PREPARE);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.setStage(WorkflowStage.SIMULATE);

        // Track subscription cleanup
        const unsubscribers: Array<() => void> = [];
        let subscriptionCount = 0;

        // Subscribe to stores as the component would
        unsubscribers.push(
            pathStore.subscribe(() => {
                subscriptionCount++;
            })
        );

        unsubscribers.push(
            rapidStore.subscribe(() => {
                subscriptionCount++;
            })
        );

        unsubscribers.push(
            chainStore.subscribe(() => {
                subscriptionCount++;
            })
        );

        // Verify subscriptions are active
        expect(subscriptionCount).toBeGreaterThan(0);

        // Clean up subscriptions as component would in onDestroy
        unsubscribers.forEach((fn) => fn());

        // Clear the array
        unsubscribers.length = 0;

        // Verify we can still navigate without errors
        expect(() => {
            workflowStore.setStage(WorkflowStage.PROGRAM);
        }).not.toThrow();

        // Verify workflow state is correct
        expect(get(workflowStore).currentStage).toBe(WorkflowStage.PROGRAM);
    });

    it('should handle navigation after adding paths and rapids', () => {
        // Complete required stages
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.completeStage(WorkflowStage.EDIT);
        workflowStore.completeStage(WorkflowStage.PREPARE);
        workflowStore.completeStage(WorkflowStage.PROGRAM);

        // Add test data
        pathStore.addPath({
            id: 'test-path-1',
            name: 'Test Path',
            operationId: 'test-op',
            chainId: 'test-chain',
            toolId: 'test-tool',
            enabled: true,
            order: 1,
            feedRate: 1000,
            cutDirection: CutDirection.COUNTERCLOCKWISE,
        });

        rapidStore.setRapids([
            {
                id: 'test-rapid',
                start: { x: 0, y: 0 },
                end: { x: 10, y: 10 },
                type: 'rapid',
            },
        ]);

        // Navigate to simulate
        workflowStore.setStage(WorkflowStage.SIMULATE);
        expect(get(workflowStore).currentStage).toBe(WorkflowStage.SIMULATE);

        // Create subscriptions
        const unsubscribers: Array<() => void> = [];

        unsubscribers.push(pathStore.subscribe(() => {}));
        unsubscribers.push(rapidStore.subscribe(() => {}));
        unsubscribers.push(operationsStore.subscribe(() => {}));
        unsubscribers.push(drawingStore.subscribe(() => {}));
        unsubscribers.push(uiStore.subscribe(() => {}));

        // Clean up subscriptions before navigating away
        unsubscribers.forEach((fn) => fn());

        // Navigate back to program
        expect(() => {
            workflowStore.setStage(WorkflowStage.PROGRAM);
        }).not.toThrow();

        expect(get(workflowStore).currentStage).toBe(WorkflowStage.PROGRAM);
    });

    it('should allow multiple navigation cycles without errors', () => {
        // Complete all stages
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.completeStage(WorkflowStage.EDIT);
        workflowStore.completeStage(WorkflowStage.PREPARE);
        workflowStore.completeStage(WorkflowStage.PROGRAM);

        // Navigate through stages multiple times
        for (let i = 0; i < 3; i++) {
            // Go to simulate
            workflowStore.setStage(WorkflowStage.SIMULATE);
            expect(get(workflowStore).currentStage).toBe(
                WorkflowStage.SIMULATE
            );

            // Create and clean up subscriptions
            const unsubscribers: Array<() => void> = [];
            unsubscribers.push(pathStore.subscribe(() => {}));
            unsubscribers.push(rapidStore.subscribe(() => {}));
            unsubscribers.forEach((fn) => fn());

            // Go back to program
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.PROGRAM);

            // Go to edit
            workflowStore.setStage(WorkflowStage.EDIT);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.EDIT);
        }
    });
});
