/**
 * Test to verify workflow stage persistence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    saveApplicationState,
    restoreApplicationState,
} from '../stores/persistence';
import {
    WorkflowStage,
    workflowStore,
    type WorkflowState,
} from '../stores/workflow';

// Mock localStorage
const localStorageMock = {
    data: {} as Record<string, string>,
    getItem: (key: string) => localStorageMock.data[key] || null,
    setItem: (key: string, value: string) => {
        localStorageMock.data[key] = value;
    },
    removeItem: (key: string) => {
        delete localStorageMock.data[key];
    },
    clear: () => {
        localStorageMock.data = {};
    },
};

// Replace global localStorage with mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('Workflow Stage Persistence', () => {
    beforeEach(() => {
        localStorageMock.clear();
        // Reset workflow to initial state
        workflowStore.reset();
    });

    it('should persist and restore current workflow stage', async () => {
        // Verify initial state
        let workflowState: WorkflowState | null = null;
        const unsubscribe1 = workflowStore.subscribe((state) => {
            workflowState = state;
        });
        unsubscribe1();
        expect(workflowState!.currentStage).toBe(WorkflowStage.IMPORT); // Initial stage

        // Progress through stages properly: complete current, then advance
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.setStage(WorkflowStage.EDIT);
        workflowStore.completeStage(WorkflowStage.EDIT);
        workflowStore.setStage(WorkflowStage.PREPARE);
        workflowStore.completeStage(WorkflowStage.PREPARE);
        workflowStore.setStage(WorkflowStage.PROGRAM);

        // Verify current state before saving
        const unsubscribe2 = workflowStore.subscribe((state) => {
            workflowState = state;
        });
        unsubscribe2();

        expect(workflowState!.currentStage).toBe(WorkflowStage.PROGRAM);
        expect(workflowState!.completedStages.has(WorkflowStage.IMPORT)).toBe(
            true
        );
        expect(workflowState!.completedStages.has(WorkflowStage.EDIT)).toBe(
            true
        );
        expect(workflowState!.completedStages.has(WorkflowStage.PREPARE)).toBe(
            true
        );

        // Save application state
        await saveApplicationState();

        // Reset workflow to simulate fresh app load
        workflowStore.reset();

        // Verify reset worked
        const unsubscribe3 = workflowStore.subscribe((state) => {
            workflowState = state;
        });
        unsubscribe3();
        expect(workflowState!.currentStage).toBe(WorkflowStage.IMPORT); // Back to initial

        // Restore application state
        await restoreApplicationState();

        // Verify stage was restored correctly
        const unsubscribe4 = workflowStore.subscribe((state) => {
            workflowState = state;
        });
        unsubscribe4();
        expect(workflowState!.currentStage).toBe(WorkflowStage.PROGRAM); // Should be restored
        expect(workflowState!.completedStages.has(WorkflowStage.IMPORT)).toBe(
            true
        );
        expect(workflowState!.completedStages.has(WorkflowStage.EDIT)).toBe(
            true
        );
        expect(workflowState!.completedStages.has(WorkflowStage.PREPARE)).toBe(
            true
        );
    });

    it('should handle different workflow stages correctly', async () => {
        // Test each stage with proper progression
        const testCases = [
            { stage: WorkflowStage.IMPORT, completed: [] },
            { stage: WorkflowStage.EDIT, completed: [WorkflowStage.IMPORT] },
            {
                stage: WorkflowStage.PREPARE,
                completed: [WorkflowStage.IMPORT, WorkflowStage.EDIT],
            },
            {
                stage: WorkflowStage.PROGRAM,
                completed: [
                    WorkflowStage.IMPORT,
                    WorkflowStage.EDIT,
                    WorkflowStage.PREPARE,
                ],
            },
            {
                stage: WorkflowStage.SIMULATE,
                completed: [
                    WorkflowStage.IMPORT,
                    WorkflowStage.EDIT,
                    WorkflowStage.PREPARE,
                    WorkflowStage.PROGRAM,
                ],
            },
            {
                stage: WorkflowStage.EXPORT,
                completed: [
                    WorkflowStage.IMPORT,
                    WorkflowStage.EDIT,
                    WorkflowStage.PREPARE,
                    WorkflowStage.PROGRAM,
                    WorkflowStage.SIMULATE,
                ],
            },
        ];

        for (const testCase of testCases) {
            // Reset workflow first
            workflowStore.reset();

            // Complete prerequisite stages
            for (const completedStage of testCase.completed) {
                workflowStore.completeStage(completedStage as WorkflowStage);
            }

            // Set current stage
            workflowStore.setStage(testCase.stage as WorkflowStage);

            // Save state
            await saveApplicationState();

            // Reset
            workflowStore.reset();

            // Restore
            await restoreApplicationState();

            // Verify
            let workflowState: WorkflowState | null = null;
            const unsubscribe = workflowStore.subscribe((state) => {
                workflowState = state;
            });
            unsubscribe();
            expect(workflowState!.currentStage).toBe(testCase.stage);
        }
    });

    it('should persist completed stages correctly', async () => {
        // Complete several stages in order
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.setStage(WorkflowStage.EDIT);
        workflowStore.completeStage(WorkflowStage.EDIT);
        workflowStore.setStage(WorkflowStage.PREPARE);
        workflowStore.completeStage(WorkflowStage.PREPARE);
        workflowStore.setStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.setStage(WorkflowStage.SIMULATE);

        // Save and restore
        await saveApplicationState();
        workflowStore.reset();
        await restoreApplicationState();

        // Verify completed stages were restored
        let workflowState: WorkflowState | null = null;
        const unsubscribe = workflowStore.subscribe((state) => {
            workflowState = state;
        });
        unsubscribe();

        expect(workflowState!.currentStage).toBe(WorkflowStage.SIMULATE);
        expect(workflowState!.completedStages.has(WorkflowStage.IMPORT)).toBe(
            true
        );
        expect(workflowState!.completedStages.has(WorkflowStage.EDIT)).toBe(
            true
        );
        expect(workflowState!.completedStages.has(WorkflowStage.PREPARE)).toBe(
            true
        );
        expect(workflowState!.completedStages.has(WorkflowStage.PROGRAM)).toBe(
            true
        );
        expect(workflowState!.completedStages.has(WorkflowStage.SIMULATE)).toBe(
            false
        ); // Current stage, not completed
    });
});
