import type { Cut } from '$lib/cam/cut/classes.svelte';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import { createCutsFromOperation } from '$lib/cam/pipeline/operations/cut-generation';
import { SvelteSet } from 'svelte/reactivity';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import { EMPTY_BOUNDS } from '$lib/geometry/bounding-box/constants';

export class Plan {
    cuts = $state<Cut[]>([]);
    private pendingOperations = new SvelteSet<string>();

    constructor(cuts: Cut[] = []) {
        this.cuts = cuts;
    }

    get bounds(): BoundingBoxData {
        if (this.cuts.length === 0) {
            return EMPTY_BOUNDS;
        }

        const cutBounds: BoundingBoxData[] = [];

        for (const cut of this.cuts) {
            const boundary = cut.bounds;

            // Skip empty bounds (cuts with no geometry)
            if (boundary !== EMPTY_BOUNDS) {
                cutBounds.push(boundary);
            }
        }

        // If no valid bounds found
        if (cutBounds.length === 0) {
            return EMPTY_BOUNDS;
        }

        // Combine all cut bounds
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const boundary of cutBounds) {
            minX = Math.min(minX, boundary.min.x);
            minY = Math.min(minY, boundary.min.y);
            maxX = Math.max(maxX, boundary.max.x);
            maxY = Math.max(maxY, boundary.max.y);
        }

        return {
            min: { x: minX, y: minY },
            max: { x: maxX, y: maxY },
        };
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
                (cut) => cut.sourceOperationId !== operation.id
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
        this.cuts = this.cuts.filter(
            (cut) => cut.sourceOperationId !== operation.id
        );
    }

    /**
     * Translate all cuts in this plan by the given offset
     * Recursively calls Cut.translate() on each cut
     * @param dx X offset to translate by
     * @param dy Y offset to translate by
     */
    translate(dx: number, dy: number): void {
        for (const cut of this.cuts) {
            cut.translate(dx, dy);
        }
        // Reassign array to trigger Svelte 5 $state reactivity
        this.cuts = [...this.cuts];
    }
}
