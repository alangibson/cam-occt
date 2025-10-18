/**
 * Part Detection Parameters
 *
 * These parameters control the precision and behavior of geometric containment detection
 * for part detection algorithms.
 */

import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { PartType } from './enums';

export interface Part {
    id: string;
    chain: Chain;
    type: PartType.HOLE;
    boundingBox: BoundingBox;
    holes: Part[]; // Nested holes within this hole (parts)
}

export interface PartShell {
    id: string;
    chain: Chain;
    type: PartType.SHELL;
    boundingBox: BoundingBox;
    holes: Part[];
}

export interface PartDetectionParameters {
    /** Number of points to tessellate circles into. Higher values = better precision but slower performance. Range: 8-128 */
    circleTessellationPoints: number;

    /** Arc tessellation tolerance in mm. Maximum allowed deviation between arc and tessellated chords. Smaller values = more points. Range: 0.001-1.0 */
    arcTessellationTolerance: number;

    /** Decimal precision for coordinate rounding to avoid floating point errors. Range: 1-6 */
    decimalPrecision: number;

    /** Enable tessellation visualization during parts detection */
    enableTessellation: boolean;
}

export interface DetectedPart {
    id: string;
    shell: PartShell;
    holes: Part[];
}

export interface PartDetectionWarning {
    type: 'overlapping_boundary';
    chainId: string;
    message: string;
}

export interface PartDetectionResult {
    parts: DetectedPart[];
    warnings: PartDetectionWarning[];
}
