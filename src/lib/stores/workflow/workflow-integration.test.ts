import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock settings store to return all stages enabled (for testing workflow logic)
vi.mock('$lib/stores/settings/store.svelte', () => ({
    settingsStore: {
        settings: {
            enabledStages: ['import', 'program', 'simulate', 'export'],
        },
    },
}));

/* eslint-disable import/first */
import { workflowStore } from './store.svelte';
import { WorkflowStage } from './enums';
import { drawingStore } from '$lib/stores/drawing/store.svelte';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { Unit } from '$lib/config/units/units';
/* eslint-enable import/first */

describe('Workflow Integration', () => {
    beforeEach(() => {
        workflowStore.reset();
    });

    describe('Import to Program transition', () => {
        it('should allow advancing to program stage after completing import', () => {
            // Initially should be at import stage
            expect(workflowStore.currentStage).toBe(WorkflowStage.IMPORT);
            expect(workflowStore.canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                false
            );

            // Complete import stage
            workflowStore.completeStage(WorkflowStage.IMPORT);

            // Should now be able to advance to program
            expect(workflowStore.canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                true
            );

            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM);
        });

        it('should complete program stage when drawing exists', () => {
            // Progress to program stage
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.PROGRAM);

            // Simulate drawing being loaded (this would happen in ImportStage component)
            const mockDrawing = {
                shapes: [],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM as const,
                fileName: '',
            };

            drawingStore.setDrawing(new Drawing(mockDrawing), 'test.dxf');

            // Program stage should be completable now
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            expect(
                workflowStore.completedStages.has(WorkflowStage.PROGRAM)
            ).toBe(true);
            expect(workflowStore.canAdvanceTo(WorkflowStage.SIMULATE)).toBe(
                true
            );
        });
    });

    describe('Full workflow progression', () => {
        it('should allow complete workflow progression with proper stages', () => {
            const stages = [
                WorkflowStage.IMPORT,
                WorkflowStage.PROGRAM,
                WorkflowStage.SIMULATE,
                WorkflowStage.EXPORT,
            ] as const;

            // Progress through each stage
            for (let i: number = 0; i < stages.length; i++) {
                const currentStage = stages[i];

                // Should be able to set current stage
                workflowStore.setStage(currentStage);
                expect(workflowStore.currentStage).toBe(currentStage);

                // Complete current stage
                workflowStore.completeStage(currentStage);
                expect(workflowStore.completedStages.has(currentStage)).toBe(
                    true
                );

                // Next stage should be accessible (if there is one)
                if (i < stages.length - 1) {
                    const nextStage = stages[i + 1];
                    expect(workflowStore.canAdvanceTo(nextStage)).toBe(true);
                }
            }

            // All stages should be completed
            expect(workflowStore.completedStages.size).toBe(4);
        });
    });

    describe('Workflow reset', () => {
        it('should reset workflow state completely', () => {
            // Progress through some stages
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.PROGRAM);
            workflowStore.completeStage(WorkflowStage.PROGRAM);

            // Add a drawing
            const mockDrawing = {
                shapes: [],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM as const,
                fileName: 'test.dxf',
            };
            drawingStore.setDrawing(new Drawing(mockDrawing), 'test.dxf');

            // Reset workflow
            workflowStore.reset();

            // Should be back to initial state
            const state = workflowStore;
            expect(state.currentStage).toBe(WorkflowStage.IMPORT);
            expect(state.completedStages.size).toBe(0);
            expect(state.canAdvanceTo(WorkflowStage.PROGRAM)).toBe(false);

            // Drawing should still exist (workflow reset doesn't clear drawing)
            expect(drawingStore.drawing).toBeTruthy();
        });
    });

    describe('Stage validation', () => {
        it('should prevent skipping stages', () => {
            // Try to jump directly to program stage
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(workflowStore.currentStage).toBe(WorkflowStage.IMPORT); // Should remain at import

            // Try to jump to export
            workflowStore.setStage(WorkflowStage.EXPORT);
            expect(workflowStore.currentStage).toBe(WorkflowStage.IMPORT); // Should remain at import

            // Complete import, should now be able to go to program
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM); // Should work now

            // Try to skip to export without completing program
            workflowStore.setStage(WorkflowStage.EXPORT);
            expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM); // Should remain at program
        });
    });
});
