/**
 * Interfaces for offset calculation pipeline
 */

import type { Shape } from '$lib/geometry/shape/classes';
import type { OffsetDirection } from '$lib/cam/offset/types';
import type { Cut } from '$lib/cam/cut/classes.svelte';

/**
 * Result from chain offset calculation
 */
export interface ChainOffsetResult {
    offsetShapes: Shape[];
    originalShapes: Shape[];
    kerfWidth: number;
    warnings: string[];
}

export interface OffsetCalculation {
    offsetShapes: Shape[];
    originalShapes: Shape[];
    direction: OffsetDirection;
    kerfWidth: number;
    generatedAt: string;
    version: string;
}

export interface CutGenerationResult {
    cuts: Cut[];
    warnings: {
        chainId: string;
        operationId: string;
        offsetWarnings: string[];
        clearExistingWarnings: boolean;
    }[];
}
