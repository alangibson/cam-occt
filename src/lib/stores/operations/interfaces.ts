/**
 * Operations Store Interfaces
 *
 * Type definitions for operations and related data structures.
 */

import type { OperationData } from '$lib/cam/operation/interface';
import type { Operation } from '$lib/cam/operation/classes.svelte';

export interface OperationsStore {
    subscribe: (run: (value: Operation[]) => void) => () => void;
    addOperation: (operation: Omit<OperationData, 'id'>) => void;
    updateOperation: (id: string, updates: Partial<OperationData>) => void;
    deleteOperation: (id: string) => void;
    reorderOperations: (newOrder: Operation[]) => void;
    duplicateOperation: (id: string) => void;
    applyOperation: (operationId: string) => void;
    applyAllOperations: () => void;
    reset: () => void;
    getAssignedTargets: (excludeOperationId?: string) => {
        chains: Set<string>;
        parts: Set<string>;
    };
}
