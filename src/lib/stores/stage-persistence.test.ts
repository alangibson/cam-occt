/**
 * Test to verify workflow stage persistence
 */

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
import {
    restoreApplicationState,
    saveApplicationState,
} from '$lib/stores/storage/store';
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';
/* eslint-enable import/first */

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
        expect(workflowStore.currentStage).toBe(WorkflowStage.IMPORT); // Initial stage

        // Progress through stages properly: complete current, then advance
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.setStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.setStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.setStage(WorkflowStage.PROGRAM);

        // Verify current state before saving
        expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM);
        expect(workflowStore.completedStages.has(WorkflowStage.IMPORT)).toBe(
            true
        );
        expect(workflowStore.completedStages.has(WorkflowStage.PROGRAM)).toBe(
            true
        );
        expect(workflowStore.completedStages.has(WorkflowStage.PROGRAM)).toBe(
            true
        );

        // Save application state
        await saveApplicationState();

        // Reset workflow to simulate fresh app load
        workflowStore.reset();

        // Verify reset worked
        expect(workflowStore.currentStage).toBe(WorkflowStage.IMPORT); // Back to initial

        // Restore application state
        await restoreApplicationState();

        // Verify stage was restored correctly
        expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM); // Should be restored
        expect(workflowStore.completedStages.has(WorkflowStage.IMPORT)).toBe(
            true
        );
        expect(workflowStore.completedStages.has(WorkflowStage.PROGRAM)).toBe(
            true
        );
        expect(workflowStore.completedStages.has(WorkflowStage.PROGRAM)).toBe(
            true
        );
    });

    it('should handle different workflow stages correctly', async () => {
        // Test each stage with proper progression
        const testCases = [
            { stage: WorkflowStage.IMPORT, completed: [] },
            { stage: WorkflowStage.PROGRAM, completed: [WorkflowStage.IMPORT] },
            {
                stage: WorkflowStage.PROGRAM,
                completed: [WorkflowStage.IMPORT, WorkflowStage.PROGRAM],
            },
            {
                stage: WorkflowStage.PROGRAM,
                completed: [
                    WorkflowStage.IMPORT,
                    WorkflowStage.PROGRAM,
                    WorkflowStage.PROGRAM,
                ],
            },
            {
                stage: WorkflowStage.SIMULATE,
                completed: [
                    WorkflowStage.IMPORT,
                    WorkflowStage.PROGRAM,
                    WorkflowStage.PROGRAM,
                    WorkflowStage.PROGRAM,
                ],
            },
            {
                stage: WorkflowStage.EXPORT,
                completed: [
                    WorkflowStage.IMPORT,
                    WorkflowStage.PROGRAM,
                    WorkflowStage.PROGRAM,
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
            expect(workflowStore.currentStage).toBe(testCase.stage);
        }
    });

    it('should persist completed stages correctly', async () => {
        // Complete several stages in order
        workflowStore.completeStage(WorkflowStage.IMPORT);
        workflowStore.setStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.setStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.setStage(WorkflowStage.PROGRAM);
        workflowStore.completeStage(WorkflowStage.PROGRAM);
        workflowStore.setStage(WorkflowStage.SIMULATE);

        // Save and restore
        await saveApplicationState();
        workflowStore.reset();
        await restoreApplicationState();

        // Verify completed stages were restored
        expect(workflowStore.currentStage).toBe(WorkflowStage.SIMULATE);
        expect(workflowStore.completedStages.has(WorkflowStage.IMPORT)).toBe(
            true
        );
        expect(workflowStore.completedStages.has(WorkflowStage.PROGRAM)).toBe(
            true
        );
        expect(workflowStore.completedStages.has(WorkflowStage.PROGRAM)).toBe(
            true
        );
        expect(workflowStore.completedStages.has(WorkflowStage.PROGRAM)).toBe(
            true
        );
        expect(workflowStore.completedStages.has(WorkflowStage.SIMULATE)).toBe(
            false
        ); // Current stage, not completed
    });
});
