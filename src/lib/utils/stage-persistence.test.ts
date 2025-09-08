/**
 * Test to verify workflow stage persistence
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    saveApplicationState,
    restoreApplicationState,
} from '../stores/persistence';
import {
    workflowStore,
    type WorkflowState,
    type WorkflowStage,
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
        expect(workflowState!.currentStage).toBe('import'); // Initial stage

        // Progress through stages properly: complete current, then advance
        workflowStore.completeStage('import');
        workflowStore.setStage('edit');
        workflowStore.completeStage('edit');
        workflowStore.setStage('prepare');
        workflowStore.completeStage('prepare');
        workflowStore.setStage('program');

        // Verify current state before saving
        const unsubscribe2 = workflowStore.subscribe((state) => {
            workflowState = state;
        });
        unsubscribe2();

        expect(workflowState!.currentStage).toBe('program');
        expect(workflowState!.completedStages.has('import')).toBe(true);
        expect(workflowState!.completedStages.has('edit')).toBe(true);
        expect(workflowState!.completedStages.has('prepare')).toBe(true);

        // Save application state
        await saveApplicationState();

        // Reset workflow to simulate fresh app load
        workflowStore.reset();

        // Verify reset worked
        const unsubscribe3 = workflowStore.subscribe((state) => {
            workflowState = state;
        });
        unsubscribe3();
        expect(workflowState!.currentStage).toBe('import'); // Back to initial

        // Restore application state
        await restoreApplicationState();

        // Verify stage was restored correctly
        const unsubscribe4 = workflowStore.subscribe((state) => {
            workflowState = state;
        });
        unsubscribe4();
        expect(workflowState!.currentStage).toBe('program'); // Should be restored
        expect(workflowState!.completedStages.has('import')).toBe(true);
        expect(workflowState!.completedStages.has('edit')).toBe(true);
        expect(workflowState!.completedStages.has('prepare')).toBe(true);
    });

    it('should handle different workflow stages correctly', async () => {
        // Test each stage with proper progression
        const testCases = [
            { stage: 'import', completed: [] },
            { stage: 'edit', completed: ['import'] },
            { stage: 'prepare', completed: ['import', 'edit'] },
            { stage: 'program', completed: ['import', 'edit', 'prepare'] },
            {
                stage: 'simulate',
                completed: ['import', 'edit', 'prepare', 'program'],
            },
            {
                stage: 'export',
                completed: ['import', 'edit', 'prepare', 'program', 'simulate'],
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
        workflowStore.completeStage('import');
        workflowStore.setStage('edit');
        workflowStore.completeStage('edit');
        workflowStore.setStage('prepare');
        workflowStore.completeStage('prepare');
        workflowStore.setStage('program');
        workflowStore.completeStage('program');
        workflowStore.setStage('simulate');

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

        expect(workflowState!.currentStage).toBe('simulate');
        expect(workflowState!.completedStages.has('import')).toBe(true);
        expect(workflowState!.completedStages.has('edit')).toBe(true);
        expect(workflowState!.completedStages.has('prepare')).toBe(true);
        expect(workflowState!.completedStages.has('program')).toBe(true);
        expect(workflowState!.completedStages.has('simulate')).toBe(false); // Current stage, not completed
    });
});
