import { STANDARD_GRID_SPACING } from '$lib/constants';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';
import type { SplineTessellationConfig } from './interfaces';

/**
 * Minimum number of control points required for a valid spline
 */
export const MIN_CONTROL_POINTS_FOR_SPLINE = 2;

/**
 * Default degree for spline curves
 */
export const DEFAULT_SPLINE_DEGREE = 3;

/**
 * Number of samples to use for spline calculations
 */
export const SPLINE_SAMPLE_COUNT = 100;

/**
 * Number of samples to use for spline validation
 */
export const VALIDATION_SAMPLE_COUNT = 50;

/**
 * Fine tessellation tolerance for spline rendering (pixels)
 */
export const SPLINE_TESSELLATION_TOLERANCE: number = 0.1;

/**
 * Spline complexity weight multiplier
 */
export const SPLINE_COMPLEXITY_WEIGHT_MULTIPLIER = 1.5;

/**
 * Closed spline complexity multiplier
 */
export const CLOSED_SPLINE_COMPLEXITY_MULTIPLIER = 1.2;

/**
 * Maximum number of tessellation samples for splines
 */
export const MAX_SPLINE_TESSELLATION_SAMPLES = 200;

/**
 * Maximum number of adaptive tessellation samples
 */
export const MAX_ADAPTIVE_TESSELLATION_SAMPLES = 500;

/**
 * Standard tessellation timeout in milliseconds
 */
export const STANDARD_TESSELLATION_TIMEOUT_MS = 5000;

/**
 * High complexity tessellation timeout in milliseconds
 */
export const HIGH_COMPLEXITY_TIMEOUT_MS = 10000;

/**
 * Tessellation sample multiplier
 */
export const TESSELLATION_SAMPLE_MULTIPLIER = 3;

/**
 * Default retry count for spline intersection operations
 */
export const DEFAULT_RETRY_COUNT = 3;
/**
 * Default tessellation configuration
 */
export const DEFAULT_CONFIG: Required<SplineTessellationConfig> = {
    method: 'verb-nurbs',
    numSamples: 50,
    tolerance: CHAIN_CLOSURE_TOLERANCE,
    maxSamples: MAX_SPLINE_TESSELLATION_SAMPLES,
    minSamples: STANDARD_GRID_SPACING,
    timeoutMs: STANDARD_TESSELLATION_TIMEOUT_MS,
};
