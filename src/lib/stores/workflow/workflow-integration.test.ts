import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { workflowStore } from './store';
import { WorkflowStage } from './enums';
import { drawingStore } from '../drawing/store';
import { Unit } from '../../utils/units';

describe('Workflow Integration', () => {
    beforeEach(() => {
        workflowStore.reset();
    });

    describe('Import to Edit transition', () => {
        it('should allow advancing to edit stage after completing import', () => {
            // Initially should be at import stage
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.IMPORT);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EDIT)).toBe(
                false
            );

            // Complete import stage
            workflowStore.completeStage(WorkflowStage.IMPORT);

            // Should now be able to advance to edit
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EDIT)).toBe(
                true
            );

            workflowStore.setStage(WorkflowStage.EDIT);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.EDIT);
        });

        it('should auto-complete edit stage when drawing exists', () => {
            // Progress to edit stage
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.EDIT);

            // Simulate drawing being loaded (this would happen in ImportStage component)
            const mockDrawing = {
                shapes: [],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM as const,
            };

            drawingStore.setDrawing(mockDrawing);

            // Edit stage should be completable now
            workflowStore.completeStage(WorkflowStage.EDIT);
            expect(
                get(workflowStore).completedStages.has(WorkflowStage.EDIT)
            ).toBe(true);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PREPARE)).toBe(
                true
            );
        });
    });

    describe('Full workflow progression', () => {
        it('should allow complete workflow progression with proper stages', () => {
            const stages = [
                WorkflowStage.IMPORT,
                WorkflowStage.EDIT,
                WorkflowStage.PREPARE,
                WorkflowStage.PROGRAM,
                WorkflowStage.SIMULATE,
                WorkflowStage.EXPORT,
            ] as const;

            // Progress through each stage
            for (let i: number = 0; i < stages.length; i++) {
                const currentStage = stages[i];

                // Should be able to set current stage
                workflowStore.setStage(currentStage);
                expect(get(workflowStore).currentStage).toBe(currentStage);

                // Complete current stage
                workflowStore.completeStage(currentStage);
                expect(
                    get(workflowStore).completedStages.has(currentStage)
                ).toBe(true);

                // Next stage should be accessible (if there is one)
                if (i < stages.length - 1) {
                    const nextStage = stages[i + 1];
                    expect(get(workflowStore).canAdvanceTo(nextStage)).toBe(
                        true
                    );
                }
            }

            // All stages should be completed
            expect(get(workflowStore).completedStages.size).toBe(6);
        });
    });

    describe('Workflow reset', () => {
        it('should reset workflow state completely', () => {
            // Progress through some stages
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.EDIT);

            // Add a drawing
            const mockDrawing = {
                shapes: [],
                bounds: { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } },
                units: Unit.MM as const,
            };
            drawingStore.setDrawing(mockDrawing);

            // Reset workflow
            workflowStore.reset();

            // Should be back to initial state
            const state = get(workflowStore);
            expect(state.currentStage).toBe(WorkflowStage.IMPORT);
            expect(state.completedStages.size).toBe(0);
            expect(state.canAdvanceTo(WorkflowStage.EDIT)).toBe(false);

            // Drawing should still exist (workflow reset doesn't clear drawing)
            expect(get(drawingStore).drawing).toBeTruthy();
        });
    });

    describe('Stage validation', () => {
        it('should prevent skipping stages', () => {
            // Try to jump directly to program stage
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.IMPORT); // Should remain at import

            // Try to jump to export
            workflowStore.setStage(WorkflowStage.EXPORT);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.IMPORT); // Should remain at import

            // Complete import, should still not be able to skip to program
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.IMPORT); // Should remain at import (edit not completed)

            // Only after completing edit should program be accessible
            workflowStore.setStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.setStage(WorkflowStage.PREPARE);
            workflowStore.completeStage(WorkflowStage.PREPARE);
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.PROGRAM); // Now should work
        });
    });
});
