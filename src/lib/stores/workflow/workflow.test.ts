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
/* eslint-enable import/first */

describe('Workflow Store - Breadcrumbs Navigation', () => {
    beforeEach(() => {
        // Reset workflow store to initial state before each test
        workflowStore.reset();
    });

    describe('Initial State', () => {
        it('should start with import stage as current', () => {
            const state = workflowStore;
            expect(state.currentStage).toBe(WorkflowStage.IMPORT);
        });

        it('should have no completed stages initially', () => {
            const state = workflowStore;
            expect(state.completedStages.size).toBe(0);
        });

        it('should only allow access to import stage initially', () => {
            expect(workflowStore.canAdvanceTo(WorkflowStage.IMPORT)).toBe(true);
            expect(workflowStore.canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                false
            );
            expect(workflowStore.canAdvanceTo(WorkflowStage.SIMULATE)).toBe(
                false
            );
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );
        });
    });

    describe('Sequential Stage Progression', () => {
        it('should enable program stage after import is completed', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);

            expect(workflowStore.canAdvanceTo(WorkflowStage.IMPORT)).toBe(true);
            expect(workflowStore.canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                true
            );
            expect(workflowStore.canAdvanceTo(WorkflowStage.SIMULATE)).toBe(
                false
            );
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );
        });

        it('should enable simulate and export stages after program is completed', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.PROGRAM);

            expect(workflowStore.canAdvanceTo(WorkflowStage.IMPORT)).toBe(true);
            expect(workflowStore.canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                true
            );
            expect(workflowStore.canAdvanceTo(WorkflowStage.SIMULATE)).toBe(
                true
            );
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true); // Export now available when program is completed
        });

        it('should enable export stage after simulate is completed', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            workflowStore.completeStage(WorkflowStage.SIMULATE);

            expect(workflowStore.canAdvanceTo(WorkflowStage.IMPORT)).toBe(true);
            expect(workflowStore.canAdvanceTo(WorkflowStage.PROGRAM)).toBe(
                true
            );
            expect(workflowStore.canAdvanceTo(WorkflowStage.SIMULATE)).toBe(
                true
            );
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true);
        });
    });

    describe('Export Stage Accessibility Rules', () => {
        it('should make export stage accessible when program is completed (even without simulate)', () => {
            // Complete all stages except simulate
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            // Note: simulate NOT completed

            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true); // Export is available when program is completed
        });

        it('should keep export stage inaccessible if program is not completed', () => {
            // Complete only import
            workflowStore.completeStage(WorkflowStage.IMPORT);

            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );
        });

        it('should make export accessible when program is completed (not requiring simulate)', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);

            // Before program completion
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );

            // After program completion
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true); // Export available immediately with program

            // Completing simulate doesn't change export availability
            workflowStore.completeStage(WorkflowStage.SIMULATE);
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true);
        });
    });

    describe('Stage Navigation', () => {
        it('should allow navigation to accessible stages', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);

            // Should be able to navigate to program (next available)
            workflowStore.setStage(WorkflowStage.PROGRAM);
            expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM);

            // Complete program
            workflowStore.completeStage(WorkflowStage.PROGRAM);

            // Should be able to navigate to simulate (next available)
            workflowStore.setStage(WorkflowStage.SIMULATE);
            expect(workflowStore.currentStage).toBe(WorkflowStage.SIMULATE);
        });

        it('should prevent navigation to inaccessible stages', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.PROGRAM);

            // Should not be able to skip to simulate - stage should not change
            const currentStageBefore = workflowStore.currentStage;
            workflowStore.setStage(WorkflowStage.SIMULATE);
            expect(workflowStore.currentStage).toBe(currentStageBefore); // Should remain unchanged
        });

        it('should update current stage when navigating', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.PROGRAM);

            expect(workflowStore.currentStage).toBe(WorkflowStage.PROGRAM);
        });
    });

    describe('Stage Completion Tracking', () => {
        it('should track completed stages correctly', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.PROGRAM);

            const state = workflowStore;
            expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(true);
            expect(state.completedStages.has(WorkflowStage.PROGRAM)).toBe(true);
            expect(state.completedStages.has(WorkflowStage.SIMULATE)).toBe(
                false
            );
        });

        it('should allow re-completing stages without issues', () => {
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.IMPORT); // Complete again

            const state = workflowStore;
            expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(true);
            expect(state.completedStages.size).toBe(1);
        });
    });

    describe('Workflow Reset', () => {
        it('should reset all workflow state', () => {
            // Complete some stages
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            workflowStore.setStage(WorkflowStage.PROGRAM);

            // Reset
            workflowStore.reset();

            const state = workflowStore;
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

            // setStage with invalid stage should not be allowed because it's not in enabled stages
            // Invalid stages are filtered out by validateStageAdvancement
            const currentStageBefore = workflowStore.currentStage;
            workflowStore.setStage('invalid' as WorkflowStage);

            // The invalid stage should NOT be set; current stage should remain unchanged
            expect(workflowStore.currentStage).toBe(currentStageBefore);
        });

        it('should maintain workflow integrity after multiple operations', () => {
            // Random sequence of operations
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.PROGRAM);
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            workflowStore.setStage(WorkflowStage.IMPORT); // Go back
            workflowStore.setStage(WorkflowStage.PROGRAM); // Go forward

            // Verify final state is consistent
            expect(workflowStore.canAdvanceTo(WorkflowStage.SIMULATE)).toBe(
                true
            );
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true); // Export is available when program is completed
        });
    });

    describe('Real-world Export Stage Scenarios', () => {
        it('should simulate typical user workflow to export', () => {
            // Simulate a typical user journey

            // 1. Import a file
            workflowStore.completeStage(WorkflowStage.IMPORT);
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(
                false
            );

            // 2. Create operations (program stage)
            workflowStore.setStage(WorkflowStage.PROGRAM);
            workflowStore.completeStage(WorkflowStage.PROGRAM);
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true); // Export is available when program is completed

            // 3. Run simulation (simulate stage)
            workflowStore.setStage(WorkflowStage.SIMULATE);
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true); // Already accessible after program

            workflowStore.completeStage(WorkflowStage.SIMULATE); // Complete simulation
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true); // Still accessible

            // 4. Navigate to export
            workflowStore.setStage(WorkflowStage.EXPORT);
            expect(workflowStore.currentStage).toBe(WorkflowStage.EXPORT);
        });

        it('should allow export after program without simulation', () => {
            // Complete program stage
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.completeStage(WorkflowStage.PROGRAM);

            // Navigate to simulate but don't complete it
            workflowStore.setStage(WorkflowStage.SIMULATE);

            // Export should be accessible after program completion
            expect(workflowStore.canAdvanceTo(WorkflowStage.EXPORT)).toBe(true);

            // Should be able to navigate to export even without completing simulate
            workflowStore.setStage(WorkflowStage.EXPORT);
            expect(workflowStore.currentStage).toBe(WorkflowStage.EXPORT); // Can navigate to export
        });
    });

    describe('Navigation and Store Methods', () => {
        beforeEach(() => {
            // Complete some stages for navigation testing
            workflowStore.completeStage(WorkflowStage.IMPORT);
            workflowStore.setStage(WorkflowStage.PROGRAM);
        });

        describe('canAdvanceTo method', () => {
            it('should return true for accessible stages', () => {
                const canAdvance = workflowStore.canAdvanceTo(
                    WorkflowStage.PROGRAM
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
                expect(nextStage).toBe(WorkflowStage.SIMULATE); // At PROGRAM, next is SIMULATE
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
                expect(prevStage).toBe(WorkflowStage.IMPORT);
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

                // Reset from program stage
                workflowStore.resetFromStage(WorkflowStage.PROGRAM);

                const state = workflowStore;
                expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.PROGRAM)).toBe(
                    false
                );
                expect(state.completedStages.has(WorkflowStage.SIMULATE)).toBe(
                    false
                );
            });

            it('should move current stage back when resetting from earlier stage', () => {
                workflowStore.completeStage(WorkflowStage.PROGRAM);
                workflowStore.setStage(WorkflowStage.SIMULATE);

                // Reset from program stage (current stage should move back)
                workflowStore.resetFromStage(WorkflowStage.PROGRAM);

                const state = workflowStore;
                expect(state.currentStage).toBe(WorkflowStage.PROGRAM);
            });

            it('should not move current stage back when resetting from later stage', () => {
                workflowStore.setStage(WorkflowStage.PROGRAM);

                // Reset from simulate stage (current stage should stay the same)
                workflowStore.resetFromStage(WorkflowStage.SIMULATE);

                const state = workflowStore;
                expect(state.currentStage).toBe(WorkflowStage.PROGRAM);
            });
        });

        describe('invalidateDownstreamStages method', () => {
            it('should invalidate stages after specified stage', () => {
                workflowStore.completeStage(WorkflowStage.PROGRAM);
                workflowStore.completeStage(WorkflowStage.SIMULATE);

                // Invalidate downstream from import
                workflowStore.invalidateDownstreamStages(WorkflowStage.IMPORT);

                const state = workflowStore;
                expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(
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
                    WorkflowStage.PROGRAM,
                ]);

                const state = workflowStore;
                expect(state.currentStage).toBe(WorkflowStage.PROGRAM);
                expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(
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
                ]);

                const state = workflowStore;
                expect(state.currentStage).toBe(WorkflowStage.EXPORT);
                expect(state.completedStages.has(WorkflowStage.IMPORT)).toBe(
                    true
                );
                expect(state.completedStages.has(WorkflowStage.PROGRAM)).toBe(
                    false
                );
            });
        });
    });
});
