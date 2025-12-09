import { CURVE_TESSELLATION_TOLERANCE_MM } from '$lib/config/defaults/geometry-defaults';
import type { PartDetectionParameters } from './part-detection.interfaces';

/**
 * Static default parameters (in mm, no unit conversion)
 * Use this for module-level initialization where unit conversion isn't available
 * For runtime unit-aware values, use getDefaultPartDetectionParameters() instead
 */
export const DEFAULT_PART_DETECTION_PARAMETERS: PartDetectionParameters = {
    circleTessellationPoints: 64,
    tessellationTolerance: CURVE_TESSELLATION_TOLERANCE_MM,
    decimalPrecision: 3,
    enableTessellation: false,
};
