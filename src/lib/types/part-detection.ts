/**
 * Part Detection Parameters
 *
 * These parameters control the precision and behavior of geometric containment detection
 * for part detection algorithms.
 */

export interface PartDetectionParameters {
    /** Number of points to tessellate circles into. Higher values = better precision but slower performance. Range: 8-128 */
    circleTessellationPoints: number;

    /** Minimum number of points for arc tessellation. Higher values = better precision. Range: 4-64 */
    minArcTessellationPoints: number;

    /** Arc tessellation density factor (smaller = more points). Controls how many points per radian. Range: 0.01-0.5 */
    arcTessellationDensity: number;

    /** Decimal precision for coordinate rounding to avoid floating point errors. Range: 1-6 */
    decimalPrecision: number;

    /** Enable tessellation visualization during parts detection */
    enableTessellation: boolean;
}

export const DEFAULT_PART_DETECTION_PARAMETERS: PartDetectionParameters = {
    circleTessellationPoints: 64,
    minArcTessellationPoints: 16,
    arcTessellationDensity: Math.PI / 32, // ~0.098
    decimalPrecision: 3,
    enableTessellation: false,
};
