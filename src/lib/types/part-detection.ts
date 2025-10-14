/**
 * Part Detection Parameters
 *
 * These parameters control the precision and behavior of geometric containment detection
 * for part detection algorithms.
 */

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

export const DEFAULT_PART_DETECTION_PARAMETERS: PartDetectionParameters = {
    circleTessellationPoints: 64,
    arcTessellationTolerance: 0.1, // 0.1 mm maximum chord error
    decimalPrecision: 3,
    enableTessellation: false,
};
