/**
 * Interfaces for offset calculation pipeline
 */

import type { Shape } from '$lib/geometry/shape/interfaces';
import type { GapFillingResult } from '$lib/cam/cut/types';
import type { OffsetDirection } from '$lib/cam/offset/types';
import type { Cut } from '$lib/cam/cut/interfaces';

/**
 * Result from chain offset calculation
 */
export interface ChainOffsetResult {
    offsetShapes: Shape[];
    originalShapes: Shape[];
    kerfWidth: number;
    gapFills?: GapFillingResult[];
    warnings: string[];
}

export interface OffsetCalculation {
    offsetShapes: Shape[];
    originalShapes: Shape[];
    direction: OffsetDirection;
    kerfWidth: number;
    generatedAt: string;
    version: string;
    gapFills?: GapFillingResult[];
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
