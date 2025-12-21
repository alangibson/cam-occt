import { SvelteSet } from 'svelte/reactivity';
import { planStore } from '$lib/stores/plan/store.svelte';
import { workflowStore } from '$lib/stores/workflow/store.svelte';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { visualizationStore } from '$lib/stores/visualization/classes.svelte';
import { drawingStore } from '$lib/stores/drawing/store.svelte';
import { toolStore } from '$lib/stores/tools/store.svelte';
import type { Part } from '$lib/cam/part/classes.svelte';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { OperationData } from '$lib/cam/operation/interface';
import { Operation } from '$lib/cam/operation/classes.svelte';

/**
 * Helper function to resolve operation IDs to actual objects and set them on the operation
 */
function resolveOperationReferences(operation: Operation): void {
    // Get required state data
    const tools = toolStore.tools;

    // Get chains from drawing layers (drawingStore uses Svelte 5 runes)
    const chains: ChainData[] = drawingStore.drawing
        ? Object.values(drawingStore.drawing.layers).flatMap(
              (layer) => layer.chains
          )
        : [];

    // Get parts from drawing layers
    const parts: Part[] = drawingStore.drawing
        ? Object.values(drawingStore.drawing.layers).flatMap(
              (layer) => layer.parts
          )
        : [];

    // Resolve tool
    const tool = operation.toolId
        ? tools.find((t) => t.id === operation.toolId) || null
        : null;
    operation.setTool(tool);

    // Resolve targets
    const targets: (ChainData | Part)[] = [];
    if (operation.targetType === 'chains') {
        for (const targetId of operation.targetIds) {
            const chain = chains.find((c) => c.id === targetId);
            if (chain) {
                targets.push(chain);
            }
        }
    } else if (operation.targetType === 'parts') {
        for (const targetId of operation.targetIds) {
            const part = parts.find((p) => p.id === targetId);
            if (part) {
                targets.push(part);
            }
        }
    }
    operation.setTargets(targets);
}

class OperationsStore {
    operations = $state<Operation[]>([]);

    addOperation(operation: Omit<OperationData, 'id'>) {
        // Create new Operation
        const newOperation = new Operation({
            ...operation,
            id: crypto.randomUUID(),
        });

        // Resolve IDs to objects
        resolveOperationReferences(newOperation);

        // Add operation to store synchronously
        this.operations = [...this.operations, newOperation];
    }

    updateOperation(id: string, updates: Partial<OperationData>) {
        // Update store synchronously
        this.operations = this.operations.map((op) => {
            if (op.id === id) {
                const updatedOp = new Operation({
                    ...op.toData(),
                    ...updates,
                });
                resolveOperationReferences(updatedOp);
                return updatedOp;
            }
            return op;
        });
    }

    deleteOperation(id: string) {
        // Get the operation before deleting
        const operation = this.operations.find((op) => op.id === id);

        // Remove all cuts created by this operation using Plan
        if (operation) {
            planStore.plan.remove(operation);
        }

        this.operations = this.operations.filter((op) => op.id !== id);
    }

    reorderOperations(newOrder: Operation[]) {
        this.operations = newOrder;
    }

    duplicateOperation(id: string) {
        // Look up Operation by id
        const operation = this.operations.find((op) => op.id === id);
        if (!operation) return;

        // Create clone Operation
        const newOperation = new Operation({
            ...operation.toData(),
            id: crypto.randomUUID(),
            name: `${operation.name} (Copy)`,
            order: Math.max(...this.operations.map((op) => op.order)) + 1,
        });

        // Resolve IDs to objects
        resolveOperationReferences(newOperation);

        // Add duplicated operation to store synchronously
        this.operations = [...this.operations, newOperation];
    }

    async applyOperation(operationId: string) {
        // Look up Operation by id
        const operation = this.operations.find((op) => op.id === operationId);

        if (operation && operation.enabled) {
            // Generate and add cuts for this operation using Plan
            await planStore.plan.add(operation, visualizationStore.tolerance);

            // Check if translate to positive is enabled and apply if so
            // if (
            //     settingsStore.settings.enabledProgramSteps.includes(
            //         PreprocessingStep.TranslateToPositive
            //     ) &&
            //     drawingStore.drawing
            // ) {
            //     drawingStore.drawing.originTo(
            //         OriginLocation.BOTTOM_LEFT,
            //         planStore.plan
            //     );
            // }

            // Check if any cuts exist and mark program stage as complete
            if (planStore.plan.cuts.length > 0) {
                workflowStore.completeStage(WorkflowStage.PROGRAM);
            }
        }
    }

    async applyAllOperations() {
        // Clear existing cuts first by resetting plan
        planStore.plan.cuts = [];

        // Apply all enabled operations in order
        const enabledOperations = this.operations
            .filter((op) => op.enabled)
            .sort((a, b) => a.order - b.order);

        for (const operation of enabledOperations) {
            await this.applyOperation(operation.id);
        }
    }

    reset() {
        this.operations = [];
    }

    // Get all target IDs that are already assigned to operations
    getAssignedTargets(excludeOperationId?: string): {
        chains: Set<string>;
        parts: Set<string>;
    } {
        const assignedChains = new SvelteSet<string>();
        const assignedParts = new SvelteSet<string>();

        this.operations.forEach((op) => {
            // Skip the excluded operation (for when checking during edit)
            if (excludeOperationId && op.id === excludeOperationId) return;

            // Only count enabled operations
            if (op.enabled && op.targetIds.length > 0) {
                if (op.targetType === 'chains') {
                    op.targetIds.forEach((id) => assignedChains.add(id));
                } else if (op.targetType === 'parts') {
                    op.targetIds.forEach((id) => assignedParts.add(id));
                }
            }
        });

        return { chains: assignedChains, parts: assignedParts };
    }
}

export const operationsStore = new OperationsStore();
