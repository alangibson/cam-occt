/**
 * Workflow state management for MetalHead CAM application
 * Manages the 6-stage workflow: Import → Edit → Prepare → Program → Simulate → Export
 */

import { SvelteSet } from 'svelte/reactivity';
import { WorkflowStage } from './enums';
import { validateStageAdvancement, WORKFLOW_ORDER } from './functions';
import { DefaultsManager } from '$lib/config/defaults/defaults-manager';
import { settingsStore } from '$lib/stores/settings/store.svelte';

/**
 * Get enabled stages from settings store
 */
function getEnabledStages(): WorkflowStage[] {
    return (
        settingsStore.settings?.enabledStages ?? Object.values(WorkflowStage)
    );
}

/**
 * Workflow store class using Svelte 5 runes
 */
class WorkflowStore {
    currentStage = $state<WorkflowStage>(WorkflowStage.IMPORT);
    completedStages = $state<SvelteSet<WorkflowStage>>(new SvelteSet());

    /**
     * Check if we can advance to a specific stage
     */
    canAdvanceTo(stage: WorkflowStage): boolean {
        return validateStageAdvancement(
            stage,
            this.completedStages,
            getEnabledStages()
        );
    }

    /**
     * Set the current workflow stage
     */
    setStage(stage: WorkflowStage): void {
        console.log('[WorkflowStore] setStage called', {
            stage,
            currentStage: this.currentStage,
            completedStages: Array.from(this.completedStages),
            canAdvanceTo: this.canAdvanceTo(stage),
        });

        if (this.canAdvanceTo(stage)) {
            // Sync DefaultsManager with current measurement system when transitioning stages
            // This ensures unit-aware defaults are properly updated, especially when transitioning
            // from Import to Edit stage where the unit system becomes active
            if (settingsStore.settings) {
                DefaultsManager.getInstance().updateMeasurementSystem(
                    settingsStore.settings.measurementSystem
                );
            }

            this.currentStage = stage;
            console.log('[WorkflowStore] Stage set to', stage);
        } else {
            console.log('[WorkflowStore] Cannot advance to', stage);
        }
    }

    /**
     * Mark a stage as completed
     */
    completeStage(stage: WorkflowStage): void {
        console.log('[WorkflowStore] completeStage called', {
            stage,
            beforeAdd: Array.from(this.completedStages),
        });
        this.completedStages.add(stage);
        console.log(
            '[WorkflowStore] After add:',
            Array.from(this.completedStages)
        );
    }

    /**
     * Get the next enabled stage in the workflow
     */
    getNextStage(): WorkflowStage | null {
        const enabledStages = getEnabledStages();
        const currentIndex = WORKFLOW_ORDER.indexOf(this.currentStage);

        // Find the next enabled stage
        for (let i = currentIndex + 1; i < WORKFLOW_ORDER.length; i++) {
            if (enabledStages.includes(WORKFLOW_ORDER[i])) {
                return WORKFLOW_ORDER[i];
            }
        }
        return null;
    }

    /**
     * Get the previous enabled stage in the workflow
     */
    getPreviousStage(): WorkflowStage | null {
        const enabledStages = getEnabledStages();
        const currentIndex = WORKFLOW_ORDER.indexOf(this.currentStage);

        // Find the previous enabled stage
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (enabledStages.includes(WORKFLOW_ORDER[i])) {
                return WORKFLOW_ORDER[i];
            }
        }
        return null;
    }

    /**
     * Reset workflow to initial state
     */
    reset(): void {
        this.currentStage = WorkflowStage.IMPORT;
        this.completedStages = new SvelteSet();
    }

    /**
     * Reset workflow from a specific stage
     */
    resetFromStage(stage: WorkflowStage): void {
        const stageIndex = WORKFLOW_ORDER.indexOf(stage);
        const newCompleted = new SvelteSet<WorkflowStage>();

        // Keep only completed stages before the reset stage
        for (const completedStage of this.completedStages) {
            const completedIndex = WORKFLOW_ORDER.indexOf(completedStage);
            if (completedIndex < stageIndex) {
                newCompleted.add(completedStage);
            }
        }

        this.completedStages = newCompleted;

        // If current stage is after reset stage, move back to reset stage
        const currentIndex = WORKFLOW_ORDER.indexOf(this.currentStage);
        if (currentIndex > stageIndex) {
            this.currentStage = stage;
        }
    }

    /**
     * Invalidate all stages downstream from a given stage
     */
    invalidateDownstreamStages(fromStage: WorkflowStage): void {
        const fromIndex = WORKFLOW_ORDER.indexOf(fromStage);
        const newCompleted = new SvelteSet<WorkflowStage>();

        // Keep only completed stages up to and including the fromStage
        for (const completedStage of this.completedStages) {
            const completedIndex = WORKFLOW_ORDER.indexOf(completedStage);
            if (completedIndex <= fromIndex) {
                newCompleted.add(completedStage);
            }
        }

        this.completedStages = newCompleted;
    }

    /**
     * Restore workflow state from persistence (bypasses validation)
     */
    restore(
        currentStage: WorkflowStage,
        completedStages: WorkflowStage[]
    ): void {
        this.currentStage = currentStage;
        this.completedStages = new SvelteSet(completedStages);
    }
}

// Export the workflow store instance
export const workflowStore = new WorkflowStore();
