import { writable, get } from 'svelte/store';
import { cutStore } from '$lib/stores/cuts/store';
import type { Cut } from '$lib/cam/cut/interfaces';
import { partStore } from '$lib/stores/parts/store';
import { workflowStore } from '$lib/stores/workflow/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { chainStore } from '$lib/stores/chains/store';
import { toolStore } from '$lib/stores/tools/store';
import type { DetectedPart } from '$lib/cam/part/interfaces';
import type { Operation, OperationsStore } from './interfaces';
import { createCutsFromOperation } from './functions';

function createOperationsStore(): OperationsStore {
    const { subscribe, set, update } = writable<Operation[]>([]);

    return {
        subscribe,

        addOperation: (operation: Omit<Operation, 'id'>) => {
            const newOperation: Operation = {
                ...operation,
                id: crypto.randomUUID(),
            };

            // Add operation to store synchronously
            update((operations) => [...operations, newOperation]);

            // Generate cuts for the new operation if it has targets and is enabled
            if (newOperation.enabled && newOperation.targetIds.length > 0) {
                operationsStore.applyOperation(newOperation.id);
            }
        },

        updateOperation: (id: string, updates: Partial<Operation>) => {
            // Update store synchronously
            const newOperations: Operation[] = get({ subscribe }).map((op) =>
                op.id === id ? { ...op, ...updates } : op
            );
            set(newOperations);

            // Always regenerate cuts when operation changes
            const operation: Operation | undefined = newOperations.find(
                (op) => op.id === id
            );
            if (operation) {
                operationsStore.applyOperation(operation.id);
            }
        },

        deleteOperation: (id: string) => {
            // Remove all cuts created by this operation
            cutStore.deleteCutsByOperation(id);
            update((operations) => operations.filter((op) => op.id !== id));
        },

        reorderOperations: (newOrder: Operation[]) => {
            set(newOrder);
        },

        duplicateOperation: (id: string) => {
            const operations = get({ subscribe });
            const operation: Operation | undefined = operations.find(
                (op) => op.id === id
            );
            if (!operation) return;

            const newOperation: Operation = {
                ...operation,
                id: crypto.randomUUID(),
                name: `${operation.name} (Copy)`,
                order: Math.max(...operations.map((op) => op.order)) + 1,
            };

            // Add duplicated operation to store synchronously
            update((ops) => [...ops, newOperation]);

            // Generate cuts for the duplicated operation if it has targets and is enabled
            if (newOperation.enabled && newOperation.targetIds.length > 0) {
                operationsStore.applyOperation(newOperation.id);
            }
        },

        applyOperation: async (operationId: string) => {
            const operations = get({ subscribe });
            const operation: Operation | undefined = operations.find(
                (op) => op.id === operationId
            );
            if (operation && operation.enabled) {
                // Remove existing cuts for this operation
                cutStore.deleteCutsByOperation(operation.id);

                // Get required state data
                const chainsState = get(chainStore);
                const partsState: { parts: DetectedPart[] } = get(partStore);
                const tools = get(toolStore);

                // Generate cuts with leads (async, parallelized)
                const result = await createCutsFromOperation(
                    operation,
                    chainsState.chains,
                    partsState.parts,
                    tools,
                    chainsState.tolerance
                );

                // Store all generated cuts in a single batch update
                if (result.cuts.length > 0) {
                    cutStore.addCuts(result.cuts);
                }

                // Check if any cuts exist and mark program stage as complete
                const cutsState: { cuts: Cut[] } = get(cutStore);
                if (cutsState.cuts.length > 0) {
                    workflowStore.completeStage(WorkflowStage.PROGRAM);
                }
            }
        },

        applyAllOperations: () => {
            update((operations) => {
                // Clear existing cuts first
                cutStore.reset();

                // Apply all enabled operations in order
                const enabledOperations: Operation[] = operations
                    .filter((op) => op.enabled)
                    .sort((a, b) => a.order - b.order);

                enabledOperations.forEach((operation) => {
                    operationsStore.applyOperation(operation.id);
                });

                return operations;
            });
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
