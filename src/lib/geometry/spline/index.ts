// Interfaces
export type { Spline, ValidationResult } from './interfaces';

// Constants
export {
    MIN_CONTROL_POINTS_FOR_SPLINE,
    DEFAULT_SPLINE_DEGREE,
    SPLINE_SAMPLE_COUNT,
    VALIDATION_SAMPLE_COUNT,
    SPLINE_TESSELLATION_TOLERANCE,
    SPLINE_COMPLEXITY_WEIGHT_MULTIPLIER,
    CLOSED_SPLINE_COMPLEXITY_MULTIPLIER,
    MAX_SPLINE_TESSELLATION_SAMPLES,
    MAX_ADAPTIVE_TESSELLATION_SAMPLES,
    STANDARD_TESSELLATION_TIMEOUT_MS,
    HIGH_COMPLEXITY_TIMEOUT_MS,
    TESSELLATION_SAMPLE_MULTIPLIER,
    DEFAULT_RETRY_COUNT,
} from './constants';

// Functions - Spline basic operations
export {
    getSplineStartPoint,
    getSplineEndPoint,
    reverseSpline,
    getSplinePointAt,
    normalizeSplineWeights,
} from './functions';

// Functions - NURBS evaluation
// export {
// evaluateNURBS,
// sampleNURBS,
// evaluateNURBSDerivative,
// getNURBSParameterRange,
// } from './functions';

// Functions - NURBS utilities
export {
    generateUniformKnotVector,
    generateValidKnotVector,
    validateKnotVector,
    // repairKnotVector,
} from './functions';

// Functions - Tessellation
export type {
    SplineTessellationConfig,
    SplineTessellationResult,
} from './interfaces';
export {
    tessellateSpline,
    validateSplineGeometry,
    createAdaptiveTessellationConfig,
    estimateSplineArcLength,
    simplifyTessellatedSpline,
} from './functions';
