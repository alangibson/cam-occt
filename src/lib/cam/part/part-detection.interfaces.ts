import type { Part } from './interfaces';

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
