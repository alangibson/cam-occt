import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain/constants';
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
 * Adaptive tessellation tolerance for spline rendering.
 */
export const SPLINE_TESSELLATION_TOLERANCE: number = 1e-7;

/**
 * Maximum number of adaptive tessellation samples
 * Set to a very high value to effectively remove limits
 * Adaptive tessellation will generate as many points as needed based on curvature
 */
export const MAX_ADAPTIVE_TESSELLATION_SAMPLES = Number.MAX_SAFE_INTEGER;

/**
 * High complexity tessellation timeout in milliseconds
 */
export const HIGH_COMPLEXITY_TIMEOUT_MS = 10000;

/**
 * Minimum number of samples for spline tessellation
 */
export const MIN_SPLINE_SAMPLES = 10;

/**
 * Default tessellation configuration
 */
export const DEFAULT_CONFIG: Required<SplineTessellationConfig> = {
    method: 'verb-nurbs',
    numSamples: 50,
    tolerance: CHAIN_CLOSURE_TOLERANCE,
    maxSamples: 1000,
    minSamples: MIN_SPLINE_SAMPLES,
    timeoutMs: 5000,
};
