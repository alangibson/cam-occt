/**
 * Part Detection Parameters
 *
 * These parameters control the precision and behavior of geometric containment detection
 * for part detection algorithms.
 */

import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { PartType } from './enums';
import type { Part as PartClass } from './classes.svelte';

export type Part = PartClass;

export interface PartData {
    id: string;
    shell: ChainData;
    type: PartType.SHELL;
    boundingBox: BoundingBox;
    voids: PartVoid[];
    slots: PartSlot[];
    layerName: string;
}

// Closed Chain inside of a shell
export interface PartVoid {
    id: string;
    chain: ChainData;
    type: PartType.HOLE;
    boundingBox: BoundingBox;
}

// Open Chain inside of a shell
export interface PartSlot {
    id: string;
    chain: ChainData;
    type: PartType.SLOT;
    boundingBox: BoundingBox;
}

export interface PartDetectionParameters {
    /** Number of points to tessellate circles into. Higher values = better precision but slower performance. Range: 8-128 */
    circleTessellationPoints: number;

    /** Curve tessellation tolerance in mm. Maximum allowed deviation between arc and tessellated chords. Smaller values = more points. Range: 0.001-1.0 */
    tessellationTolerance: number;

    /** Decimal precision for coordinate rounding to avoid floating point errors. Range: 1-6 */
    decimalPrecision: number;

    /** Enable tessellation visualization during parts detection */
    enableTessellation: boolean;
}

export interface PartDetectionWarning {
    type: 'overlapping_boundary';
    chainId: string;
    message: string;
}

export interface PartDetectionResult {
    parts: Part[];
    warnings: PartDetectionWarning[];
}
