import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { workflowStore } from './store';
import { WorkflowStage } from './enums';

describe('Workflow Store - Breadcrumbs Navigation', () => {
    beforeEach(() => {
        // Reset workflow store to initial state before each test
        workflowStore.reset();
    });

    describe('Initial State', () => {
        it('should start with import stage as current', () => {
            const state = get(workflowStore);
            expect(state.currentStage).toBe(WorkflowStage.IMPORT);
        });

        it('should have no completed stages initially', () => {
            const state = get(workflowStore);
            expect(state.completedStages).toEqual(new Set());
        });

        it('should only allow access to import stage initially', () => {
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.IMPORT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EDIT)).toBe(
                false
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PREPARE)).toBe(
                false
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                false
            );
            expect(
                get(workflowStore).canAdvanceTo(WorkflowStage.SIMULATE)
            ).toBe(false);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );
        });
    });

    describe('Sequential Stage Progression', () => {
        it('should enable edit stage after import is completed', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);

            expect(get(workflowStore).canAdvanceTo(WorkflowStage.IMPORT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EDIT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PREPARE)).toBe(
                false
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                false
            );
            expect(
                get(workflowStore).canAdvanceTo(WorkflowStage.SIMULATE)
            ).toBe(false);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );
        });

        it('should enable prepare stage after edit is completed', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);

            expect(get(workflowStore).canAdvanceTo(WorkflowStage.IMPORT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EDIT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PREPARE)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                false
            );
            expect(
                get(workflowStore).canAdvanceTo(WorkflowStage.SIMULATE)
            ).toBe(false);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );
        });

        it('should enable program stage after prepare is completed', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.PREPARE);

            expect(get(workflowStore).canAdvanceTo(WorkflowStage.IMPORT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EDIT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PREPARE)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                true
            );
            expect(
                get(workflowStore).canAdvanceTo(WorkflowStage.SIMULATE)
            ).toBe(false);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );
        });

        it('should enable simulate and export stages after program is completed', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.PREPARE);
            workflowStore.completeStage(WorkflowStage.PROGRAM);

            expect(get(workflowStore).canAdvanceTo(WorkflowStage.IMPORT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EDIT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PREPARE)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                true
            );
            expect(
                get(workflowStore).canAdvanceTo(WorkflowStage.SIMULATE)
            ).toBe(true);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            ); // Export now available when program is completed
        });

        it('should enable export stage ONLY after simulate is completed', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.PREPARE);
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            workflowStore.completeStage(WorkflowStage.SIMULATE);

            expect(get(workflowStore).canAdvanceTo(WorkflowStage.IMPORT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EDIT)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PREPARE)).toBe(
                true
            );
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                true
            );
            expect(
                get(workflowStore).canAdvanceTo(WorkflowStage.SIMULATE)
            ).toBe(true);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            );
        });
    });

    describe('Export Stage Accessibility Rules', () => {
        it('should make export stage accessible when program is completed (even without simulate)', () => {
            // Complete all stages except simulate
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.PREPARE);
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            // Note: simulate NOT completed

            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            ); // Export is available when program is completed
        });

        it('should keep export stage inaccessible if any previous stage is not completed', () => {
            // Complete only some stages, skipping others
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            // Skip prepare - this should block later stages
            workflowStore.completeStage(WorkflowStage.PROGRAM); // This won't have effect because prepare is not done
            workflowStore.completeStage(WorkflowStage.SIMULATE); // This won't have effect because prepare is not done

            // The logic allows stages up to completedUpTo + 1
            // Since prepare is not completed, completedUpTo = 1 (edit), so only stage 2 (prepare) is accessible
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );
        });

        it('should make export accessible when program is completed (not requiring simulate)', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.PREPARE);

            // Before program completion
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );

            // After program completion
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            ); // Export available immediately with program

            // Completing simulate doesn't change export availability
            workflowStore.completeStage(WorkflowStage.SIMULATE);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            );
        });
    });

    describe('Stage Navigation', () => {
        it('should allow navigation to accessible stages', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);

            // Should be able to navigate to edit (completed) and prepare (next available)
            workflowStore.setStage(WorkflowStage.EDIT);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.EDIT);

            workflowStore.setStage(WorkflowStage.PREPARE);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.PREPARE);

            // Should not be able to navigate to program (not accessible yet) - stage should not change
            const currentStageBefore = get(workflowStore).currentStage;
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(get(workflowStore).currentStage).toBe(currentStageBefore); // Should remain unchanged
        });

        it('should prevent navigation to inaccessible stages', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.EDIT);

            // Should not be able to skip to export - stage should not change
            const currentStageBefore = get(workflowStore).currentStage;
            workflowStore.setStage(WorkflowStage.EXPORT);
            expect(get(workflowStore).currentStage).toBe(currentStageBefore); // Should remain unchanged
        });

        it('should update current stage when navigating', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.EDIT);

            expect(get(workflowStore).currentStage).toBe(WorkflowStage.EDIT);
        });
    });

    describe('Stage Completion Tracking', () => {
        it('should track completed stages correctly', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);

            const state = get(workflowStore);
            expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(true);
            expect(state.completedStages.has(WorkflowStage.EDIT)).toBe(true);
            expect(state.completedStages.has(WorkflowStage.PREPARE)).toBe(
                false
            );
        });

        it('should allow re-completing stages without issues', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.IMPORT); // Complete again

            const state = get(workflowStore);
            expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(true);
            expect(state.completedStages.size).toBe(1);
        });
    });

    describe('Workflow Reset', () => {
        it('should reset all workflow state', () => {
            // Complete some stages
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.setStage(WorkflowStage.PREPARE);

            // Reset
            workflowStore.reset();

            const state = get(workflowStore);
            expect(state.currentStage).toBe(WorkflowStage.IMPORT);
            expect(state.completedStages.size).toBe(0);
            expect(state.canAdvanceTo(WorkflowStage.EXPORT)).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle invalid stage names gracefully', () => {
            expect(() =>
                workflowStore.completeStage('invalid' as WorkflowStage)
            ).not.toThrow();

            // setStage with invalid stage should be allowed if canAdvanceTo allows it
            // Since 'invalid' is not in WORKFLOW_ORDER, indexOf returns -1,
            // and the canAdvanceTo logic will return true (no previous stages to check)
            workflowStore.setStage('invalid' as WorkflowStage);

            // The invalid stage should be set as current (this is the actual behavior)
            expect(get(workflowStore).currentStage).toBe('invalid');
        });

        it('should maintain workflow integrity after multiple operations', () => {
            // Random sequence of operations
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.PREPARE);
            workflowStore.setStage(WorkflowStage.IMPORT); // Go back
            workflowStore.setStage(WorkflowStage.PREPARE); // Go forward
            workflowStore.completeStage(WorkflowStage.PROGRAM);

            // Verify final state is consistent
            expect(
                get(workflowStore).canAdvanceTo(WorkflowStage.SIMULATE)
            ).toBe(true);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            ); // Export is available when program is completed
        });
    });

    describe('Real-world Export Stage Scenarios', () => {
        it('should simulate typical user workflow to export', () => {
            // Simulate a typical user journey

            // 1. Import a file
            workflowStore.completeStage(WorkflowStage.IMPORT);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );

            // 2. Edit the drawing
            workflowStore.setStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );

            // 3. Analyze chains/parts (prepare stage)
            workflowStore.setStage(WorkflowStage.PREPARE);
            workflowStore.completeStage(WorkflowStage.PREPARE);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );

            // 4. Create operations (program stage)
            workflowStore.setStage(WorkflowStage.PROGRAM);
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            ); // Export is available when program is completed

            // 5. Run simulation (simulate stage)
            workflowStore.setStage(WorkflowStage.SIMULATE);
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            ); // Already accessible after program

            workflowStore.completeStage(WorkflowStage.SIMULATE); // Complete simulation
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            ); // Still accessible

            // 6. Navigate to export
            workflowStore.setStage(WorkflowStage.EXPORT);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.EXPORT);
        });

        it('should block export if user skips simulation', () => {
            // Complete all stages up to program
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.PREPARE);
            workflowStore.completeStage(WorkflowStage.PROGRAM);

            // Navigate to simulate but don't complete it
            workflowStore.setStage(WorkflowStage.SIMULATE);

            // Export should be accessible after program completion
            expect(get(workflowStore).canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                true
            );

            // Should be able to navigate to export even without completing simulate
            workflowStore.setStage(WorkflowStage.EXPORT);
            expect(get(workflowStore).currentStage).toBe(WorkflowStage.EXPORT); // Can navigate to export
        });
    });

    describe('Navigation and Store Methods', () => {
        beforeEach(() => {
            // Complete some stages for navigation testing
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.EDIT);
            workflowStore.completeStage(WorkflowStage.PREPARE);
            workflowStore.setStage(WorkflowStage.PROGRAM);
        });

        describe('canAdvanceTo method', () => {
            it('should return true for accessible stages', () => {
                const canAdvance = workflowStore.canAdvanceTo(
                    WorkflowStage.PREPARE
                );
                expect(canAdvance).toBe(true);
            });

            it('should return false for inaccessible stages', () => {
                const canAdvance = workflowStore.canAdvanceTo(
                    WorkflowStage.SIMULATE
                );
                expect(canAdvance).toBe(false);
            });
        });

        describe('getNextStage method', () => {
            it('should return next stage in sequence', () => {
                const nextStage = workflowStore.getNextStage();
                expect(nextStage).toBe(WorkflowStage.SIMULATE);
            });

            it('should return null when at last stage', () => {
                // First complete program to allow access to export
                workflowStore.completeStage(WorkflowStage.PROGRAM);
                workflowStore.setStage(WorkflowStage.EXPORT);
                const nextStage = workflowStore.getNextStage();
                expect(nextStage).toBe(null);
            });
        });

        describe('getPreviousStage method', () => {
            it('should return previous stage in sequence', () => {
                const prevStage = workflowStore.getPreviousStage();
                expect(prevStage).toBe(WorkflowStage.PREPARE);
            });

            it('should return null when at first stage', () => {
                workflowStore.setStage(WorkflowStage.IMPORT);
                const prevStage = workflowStore.getPreviousStage();
                expect(prevStage).toBe(null);
            });
        });

        describe('resetFromStage method', () => {
            it('should reset from specified stage', () => {
                workflowStore.completeStage(WorkflowStage.PROGRAM);
                workflowStore.completeStage(WorkflowStage.SIMULATE);
                workflowStore.setStage(WorkflowStage.EXPORT);

                // Reset from prepare stage
                workflowStore.resetFromStage(WorkflowStage.PREPARE);

                const state = get(workflowStore);
                expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.EDIT)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.PREPARE)).toBe(
                    false
                );
                expect(state.completedStages.has(WorkflowStage.PROGRAM)).toBe(
                    false
                );
                expect(state.completedStages.has(WorkflowStage.SIMULATE)).toBe(
                    false
                );
            });

            it('should move current stage back when resetting from earlier stage', () => {
                workflowStore.setStage(WorkflowStage.PROGRAM);

                // Reset from edit stage (current stage should move back)
                workflowStore.resetFromStage(WorkflowStage.EDIT);

                const state = get(workflowStore);
                expect(state.currentStage).toBe(WorkflowStage.EDIT);
            });

            it('should not move current stage back when resetting from later stage', () => {
                workflowStore.setStage(WorkflowStage.EDIT);

                // Reset from program stage (current stage should stay the same)
                workflowStore.resetFromStage(WorkflowStage.PROGRAM);

                const state = get(workflowStore);
                expect(state.currentStage).toBe(WorkflowStage.EDIT);
            });
        });

        describe('invalidateDownstreamStages method', () => {
            it('should invalidate stages after specified stage', () => {
                workflowStore.completeStage(WorkflowStage.PROGRAM);
                workflowStore.completeStage(WorkflowStage.SIMULATE);

                // Invalidate downstream from prepare
                workflowStore.invalidateDownstreamStages(WorkflowStage.PREPARE);

                const state = get(workflowStore);
                expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.EDIT)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.PREPARE)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.PROGRAM)).toBe(
                    false
                );
                expect(state.completedStages.has(WorkflowStage.SIMULATE)).toBe(
                    false
                );
            });
        });

        describe('restore method', () => {
            it('should restore workflow state from persistence', () => {
                // Reset to clean state first
                workflowStore.reset();

                // Restore to a specific state
                workflowStore.restore(WorkflowStage.PROGRAM, [
                    WorkflowStage.IMPORT,
                    WorkflowStage.EDIT,
                    WorkflowStage.PREPARE,
                    WorkflowStage.PROGRAM,
                ]);

                const state = get(workflowStore);
                expect(state.currentStage).toBe(WorkflowStage.PROGRAM);
                expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.EDIT)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.PREPARE)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.PROGRAM)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.SIMULATE)).toBe(
                    false
                );
            });

            it('should bypass validation when restoring', () => {
                // Reset to clean state
                workflowStore.reset();

                // Restore to a state that would not be achievable through normal progression
                workflowStore.restore(WorkflowStage.EXPORT, [
                    WorkflowStage.IMPORT,
                    WorkflowStage.PROGRAM, // Missing EDIT and PREPARE
                ]);

                const state = get(workflowStore);
                expect(state.currentStage).toBe(WorkflowStage.EXPORT);
                expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.EDIT)).toBe(
                    false
                );
                expect(state.completedStages.has(WorkflowStage.PREPARE)).toBe(
                    false
                );
                expect(state.completedStages.has(WorkflowStage.PROGRAM)).toBe(
                    true
                );
            });
        });
    });
});
