import type { Cut } from '$lib/cam/cut/classes.svelte';
import type { Operation } from '$lib/cam/operation/classes.svelte';
import { createCutsFromOperation } from '$lib/cam/pipeline/operations/cut-generation';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import { EMPTY_BOUNDS } from '$lib/geometry/bounding-box/constants';
import type { CutGenerationResult } from '$lib/cam/pipeline/operations/interfaces';

export class Plan {
    cuts = $state<Cut[]>([]);
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    private pendingOperations = new Set<string>();
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    private operationFingerprints = new Map<string, string>();

    constructor(cuts: Cut[] = []) {
        this.cuts = cuts;
    }

    /**
     * Generate a fingerprint of operation's geometric properties
     * Only includes fields that affect cut geometry, excluding name/enabled/order
     */
    private getGeometricFingerprint(operation: Operation): string {
        return JSON.stringify({
            toolId: operation.toolId,
            targetType: operation.targetType,
            targetIds: operation.targetIds,
            action: operation.action,
            cutDirection: operation.cutDirection,
            leadInConfig: operation.leadInConfig,
            leadOutConfig: operation.leadOutConfig,
            kerfCompensation: operation.kerfCompensation,
            holeUnderspeedEnabled: operation.holeUnderspeedEnabled,
            holeUnderspeedPercent: operation.holeUnderspeedPercent,
            optimizeStarts: operation.optimizeStarts,
            spotDuration: operation.spotDuration,
        });
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
    async add(operation: Operation, tolerance: number): Promise<void> {
        console.log('ENTER Plan.add()');

        // Guard: skip if this operation is already being processed
        if (this.pendingOperations.has(operation.id)) {
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
            console.log('BEGIN Generate cuts with leads (async, parallelized)');
            const result: CutGenerationResult = await createCutsFromOperation(
                operation,
                tolerance
            );
            console.log('END Generate cuts with leads (async, parallelized)');

            // Validate all cuts have IDs
            // for (const cut of result.cuts) {
            //     if (!cut.id) {
            //         throw new Error('Generated cut missing required id field');
            //     }
            // }

            // Add generated cuts
            if (result.cuts.length > 0) {
                this.cuts = [...this.cuts, ...result.cuts];
            }

            // Update fingerprint after successful generation
            this.operationFingerprints.set(
                operation.id,
                this.getGeometricFingerprint(operation)
            );
        } finally {
            // Always remove from pending set
            this.pendingOperations.delete(operation.id);
        }

        console.log('EXIT Plan.add()');
    }

    /**
     * Update cuts for an operation
     * Only regenerates if geometric properties changed (skips name/enabled/order changes)
     */
    async update(operation: Operation, tolerance: number): Promise<void> {
        console.log('ENTER Plan.update()');

        performance.mark(`plan-update-${operation.id}-start`);

        const newFingerprint = this.getGeometricFingerprint(operation);
        const oldFingerprint = this.operationFingerprints.get(operation.id);

        // Skip regeneration if geometric properties unchanged
        if (oldFingerprint === newFingerprint) {
            performance.mark(`plan-update-${operation.id}-end`);
            performance.measure(
                `Plan.update(${operation.id}) - skipped`,
                `plan-update-${operation.id}-start`,
                `plan-update-${operation.id}-end`
            );
            return;
        }

        // Update fingerprint and regenerate cuts
        this.operationFingerprints.set(operation.id, newFingerprint);
        await this.add(operation, tolerance);

        performance.mark(`plan-update-${operation.id}-end`);
        performance.measure(
            `Plan.update(${operation.id})`,
            `plan-update-${operation.id}-start`,
            `plan-update-${operation.id}-end`
        );

        console.log('EXIT Plan.update()');
    }

    /**
     * Remove all cuts for an operation
     */
    remove(operation: Operation): void {
        this.cuts = this.cuts.filter(
            (cut) => cut.sourceOperationId !== operation.id
        );
        // Clean up fingerprint
        this.operationFingerprints.delete(operation.id);
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
