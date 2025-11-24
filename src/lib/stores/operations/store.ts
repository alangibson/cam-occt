import { writable, get } from 'svelte/store';
import { planStore } from '$lib/stores/plan/store';
import { workflowStore } from '$lib/stores/workflow/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { chainStore } from '$lib/stores/chains/store';
import { drawingStore } from '$lib/stores/drawing/store';
import { toolStore } from '$lib/stores/tools/store';
import type { Part } from '$lib/cam/part/classes.svelte';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { OperationsStore } from './interfaces';
import type { OperationData } from '$lib/cam/operation/interface';
import { Operation } from '$lib/cam/operation/classes.svelte';

/**
 * Helper function to resolve operation IDs to actual objects and set them on the operation
 */
function resolveOperationReferences(operation: Operation): void {
    // Get required state data
    const drawingState = get(drawingStore);
    const tools = get(toolStore);

    // Get chains from drawing layers
    const chains: ChainData[] = drawingState.drawing
        ? Object.values(drawingState.drawing.layers).flatMap(
              (layer) => layer.chains
          )
        : [];

    // Get parts from drawing layers
    const parts: Part[] = drawingState.drawing
        ? Object.values(drawingState.drawing.layers).flatMap(
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

function createOperationsStore(): OperationsStore {
    const { subscribe, set, update } = writable<Operation[]>([]);

    return {
        subscribe,

        addOperation: (operation: Omit<OperationData, 'id'>) => {
            // Create new Operation
            const newOperation = new Operation({
                ...operation,
                id: crypto.randomUUID(),
            });

            // Resolve IDs to objects
            resolveOperationReferences(newOperation);

            // Add operation to store synchronously
            update((operations) => [...operations, newOperation]);
        },

        updateOperation: (id: string, updates: Partial<OperationData>) => {
            // Update store synchronously
            const newOperations: Operation[] = get({ subscribe }).map((op) => {
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
            set(newOperations);
        },

        deleteOperation: (id: string) => {
            // Get the operation before deleting
            const operations = get({ subscribe });
            const operation = operations.find((op) => op.id === id);

            // Remove all cuts created by this operation using Plan
            if (operation) {
                const plan = get(planStore).plan;
                plan.remove(operation);
            }

            update((ops) => ops.filter((op) => op.id !== id));
        },

        reorderOperations: (newOrder: Operation[]) => {
            set(newOrder);
        },

        duplicateOperation: (id: string) => {
            const operations = get({ subscribe });

            // Look up Operation by id
            const operation: Operation | undefined = operations.find(
                (op) => op.id === id
            );
            if (!operation) return;

            // Create clone Operation
            const newOperation = new Operation({
                ...operation.toData(),
                id: crypto.randomUUID(),
                name: `${operation.name} (Copy)`,
                order: Math.max(...operations.map((op) => op.order)) + 1,
            });

            // Resolve IDs to objects
            resolveOperationReferences(newOperation);

            // Add duplicated operation to store synchronously
            update((ops) => [...ops, newOperation]);
        },

        applyOperation: async (operationId: string) => {
            // Get required state data
            const operations = get({ subscribe });
            const chainsState = get(chainStore);
            const plan = get(planStore).plan;

            // Look up Operation by id
            const operation: Operation | undefined = operations.find(
                (op) => op.id === operationId
            );

            if (operation && operation.enabled) {
                // Generate and add cuts for this operation using Plan
                await plan.add(operation, chainsState.tolerance);

                // Check if any cuts exist and mark program stage as complete
                if (plan.cuts.length > 0) {
                    workflowStore.completeStage(WorkflowStage.PROGRAM);
                }
            }
        },

        applyAllOperations: async () => {
            const operations = get({ subscribe });

            // Clear existing cuts first by resetting plan
            const plan = get(planStore).plan;
            plan.cuts = [];

            // Apply all enabled operations in order
            const enabledOperations: Operation[] = operations
                .filter((op) => op.enabled)
                .sort((a, b) => a.order - b.order);

            for (const operation of enabledOperations) {
                await operationsStore.applyOperation(operation.id);
            }
        },

        reset: () => set([]),

        // Get all target IDs that are already assigned to operations
        getAssignedTargets: (
            excludeOperationId?: string
        ): { chains: Set<string>; parts: Set<string> } => {
            const assignedChains: Set<string> = new Set<string>();
            const assignedParts: Set<string> = new Set<string>();

            const unsubscribe: () => void = subscribe((operations) => {
                operations.forEach((op) => {
                    // Skip the excluded operation (for when checking during edit)
                    if (excludeOperationId && op.id === excludeOperationId)
                        return;

                    // Only count enabled operations
                    if (op.enabled && op.targetIds.length > 0) {
                        if (op.targetType === 'chains') {
                            op.targetIds.forEach((id) =>
                                assignedChains.add(id)
                            );
                        } else if (op.targetType === 'parts') {
                            op.targetIds.forEach((id) => assignedParts.add(id));
                        }
                    }
                });
            });

            unsubscribe();
            return { chains: assignedChains, parts: assignedParts };
        },
    };
}

export const operationsStore: ReturnType<typeof createOperationsStore> =
    createOperationsStore();
