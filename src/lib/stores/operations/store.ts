import { writable, get } from 'svelte/store';
import { pathStore } from '../paths/store';
import type { Path, PathsState } from '../paths/interfaces';
import { partStore } from '../parts/store';
import { workflowStore } from '../workflow/store';
import { WorkflowStage } from '../workflow/enums';
import { chainStore } from '../chains/store';
import { toolStore } from '../tools/store';
import { leadWarningsStore } from '../lead-warnings/store';
import { offsetWarningsStore } from '../offset-warnings/store';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { PATH_UPDATE_DELAY_MS } from './constants';
import type { Operation, OperationsStore } from './interfaces';
import { calculateOperationLeads, createPathsFromOperation } from './functions';
import type { ChainStore } from '../chains/interfaces';
import type { PartStore } from '../parts/interfaces';

function createOperationsStore(): OperationsStore {
    const { subscribe, set, update } = writable<Operation[]>([]);

    return {
        subscribe,

        addOperation: (operation: Omit<Operation, 'id'>) => {
            update((operations) => {
                const newOperation: Operation = {
                    ...operation,
                    id: crypto.randomUUID(),
                };

                // Generate paths for the new operation if it has targets and is enabled
                if (newOperation.enabled && newOperation.targetIds.length > 0) {
                    setTimeout(
                        () => operationsStore.applyOperation(newOperation.id),
                        0
                    );
                }

                return [...operations, newOperation];
            });
        },

        updateOperation: (id: string, updates: Partial<Operation>) => {
            update((operations) => {
                const newOperations: Operation[] = operations.map((op) =>
                    op.id === id ? { ...op, ...updates } : op
                );

                // Always regenerate paths when operation changes
                const operation: Operation | undefined = newOperations.find(
                    (op) => op.id === id
                );
                if (operation) {
                    // Clear existing warnings for this operation before regenerating
                    leadWarningsStore.clearWarningsForOperation(id);
                    offsetWarningsStore.clearWarningsForOperation(id);
                    setTimeout(() => {
                        operationsStore.applyOperation(operation.id);
                    }, 0);
                }

                return newOperations;
            });
        },

        deleteOperation: (id: string) => {
            // Remove all paths created by this operation
            pathStore.deletePathsByOperation(id);
            // Clear any warnings for this operation
            leadWarningsStore.clearWarningsForOperation(id);
            offsetWarningsStore.clearWarningsForOperation(id);
            update((operations) => operations.filter((op) => op.id !== id));
        },

        reorderOperations: (newOrder: Operation[]) => {
            set(newOrder);
        },

        duplicateOperation: (id: string) => {
            update((operations) => {
                const operation: Operation | undefined = operations.find(
                    (op) => op.id === id
                );
                if (!operation) return operations;

                const newOperation: Operation = {
                    ...operation,
                    id: crypto.randomUUID(),
                    name: `${operation.name} (Copy)`,
                    order: Math.max(...operations.map((op) => op.order)) + 1,
                };

                // Generate paths for the duplicated operation if it has targets and is enabled
                if (newOperation.enabled && newOperation.targetIds.length > 0) {
                    setTimeout(
                        () => operationsStore.applyOperation(newOperation.id),
                        0
                    );
                }

                return [...operations, newOperation];
            });
        },

        applyOperation: (operationId: string) => {
            update((operations) => {
                const operation: Operation | undefined = operations.find(
                    (op) => op.id === operationId
                );
                if (operation && operation.enabled) {
                    // Remove existing paths for this operation
                    pathStore.deletePathsByOperation(operation.id);

                    // Get required state data
                    const chainsState: { chains: Chain[] } = get(chainStore);
                    const partsState: { parts: DetectedPart[] } =
                        get(partStore);
                    const tools = get(toolStore);

                    // Generate paths
                    const result = createPathsFromOperation(
                        operation,
                        chainsState.chains,
                        partsState.parts,
                        tools
                    );

                    // Store generated paths
                    result.paths.forEach((path) => {
                        pathStore.addPath(path);
                    });

                    // Handle warnings
                    result.warnings.forEach((warning) => {
                        if (warning.clearExistingWarnings) {
                            offsetWarningsStore.clearWarningsForChain(
                                warning.chainId
                            );
                        }
                        if (warning.offsetWarnings.length > 0) {
                            offsetWarningsStore.addWarningsFromChainOffset(
                                warning.operationId,
                                warning.chainId,
                                warning.offsetWarnings
                            );
                        }
                    });

                    // Check if any paths exist and mark program stage as complete
                    setTimeout(() => {
                        const pathsState: { paths: Path[] } = get(pathStore);
                        if (pathsState.paths.length > 0) {
                            workflowStore.completeStage(WorkflowStage.PROGRAM);
                        }
                    }, PATH_UPDATE_DELAY_MS); // Small delay to ensure path store is updated

                    // Calculate and store lead geometry for all paths in this operation
                    // Run immediately to prevent visual jumping when offset geometry exists
                    // Get current state for lead calculation
                    const pathsState: PathsState = get(pathStore);
                    const currentChainsState: ChainStore = get(chainStore);
                    const currentPartsState: PartStore = get(partStore);

                    // Calculate and store leads for all paths of an operation
                    calculateOperationLeads(
                        operation,
                        pathsState.paths,
                        currentChainsState.chains,
                        currentPartsState.parts
                    ).then((leadResults) => {
                        // Store the calculated lead geometry
                        leadResults.forEach((leadGeometry, pathId) => {
                            pathStore.updatePathLeadGeometry(
                                pathId,
                                leadGeometry
                            );
                        });
                    });
                }
                return operations;
            });
        },

        applyAllOperations: () => {
            update((operations) => {
                // Clear existing paths first
                pathStore.reset();

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
