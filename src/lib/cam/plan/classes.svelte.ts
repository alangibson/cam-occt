import type { Cut } from '$lib/cam/cut/classes.svelte';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import { createCutsFromOperation } from '$lib/cam/pipeline/operations/cut-generation';

export class Plan {
    cuts = $state<Cut[]>([]);
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    private pendingOperations = new Set<string>();

    constructor(cuts: Cut[] = []) {
        this.cuts = cuts;
    }

    /**
     * Add cuts for an operation
     * Removes existing cuts for the operation and generates new ones
     * Operation already contains tool and targets via setters
     * Idempotent: concurrent calls for the same operation will be ignored
     */
    async add(
        operation: Operation,
        tolerance: number,
        avoidLeadKerfOverlap: boolean = false
    ): Promise<void> {
        // Guard: skip if this operation is already being processed
        if (this.pendingOperations.has(operation.id)) {
            console.log(
                '[Plan] Skipping duplicate add for operation:',
                operation.id
            );
            return;
        }

        // Mark operation as pending
        this.pendingOperations.add(operation.id);

        try {
            // Remove existing cuts for this operation
            this.cuts = this.cuts.filter(
                (cut) => cut.operationId !== operation.id
            );

            // Generate cuts with leads (async, parallelized)
            const result = await createCutsFromOperation(
                operation,
                tolerance,
                avoidLeadKerfOverlap
            );

            // Validate all cuts have IDs
            for (const cut of result.cuts) {
                if (!cut.id) {
                    console.error('Cut missing id:', cut);
                    throw new Error('Generated cut missing required id field');
                }
            }

            // Add generated cuts
            if (result.cuts.length > 0) {
                this.cuts = [...this.cuts, ...result.cuts];
            }
        } finally {
            // Always remove from pending set
            this.pendingOperations.delete(operation.id);
        }
    }

    /**
     * Update cuts for an operation
     * Removes existing cuts for the operation and generates new ones
     * Alias for add() - same behavior
     */
    async update(operation: Operation, tolerance: number): Promise<void> {
        await this.add(operation, tolerance);
    }

    /**
     * Remove all cuts for an operation
     */
    remove(operation: Operation): void {
        this.cuts = this.cuts.filter((cut) => cut.operationId !== operation.id);
    }

    /**
     * Replace all cuts with a new array
     * Used for operations like reordering
     */
    updateCuts(cuts: Cut[]): void {
        // Validate all cuts have IDs
        for (const cut of cuts) {
            if (!cut.id) {
                console.error('Cut missing id:', cut);
                throw new Error('Cut missing required id field');
            }
        }
        this.cuts = cuts;
    }
}
