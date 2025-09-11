/**
 * Algorithm Parameters
 *
 * These interfaces define configurable parameters for various algorithms
 * used in the MetalHead CAM application.
 */

// Import part detection parameters for combined interface
import { TOLERANCE } from '$lib/geometry/math';
import type { PartDetectionParameters } from './part-detection';
import { DEFAULT_PART_DETECTION_PARAMETERS } from './part-detection';
// Import PartDetectionParameters and DEFAULT_PART_DETECTION_PARAMETERS directly from './part-detection'

/**
 * Chain Detection Parameters
 * Controls how shapes are connected into chains based on point proximity
 */
export interface ChainDetectionParameters {
    /** Distance tolerance for connecting shapes. Higher values connect more distant shapes. Range: 0.001-10 */
    tolerance: number;
}

export const DEFAULT_CHAIN_DETECTION_PARAMETERS: ChainDetectionParameters = {
    tolerance: 0.05,
};

/**
 * Chain Normalization Parameters
 * Controls chain traversal analysis and normalization behavior
 */
export interface ChainNormalizationParameters {
    /** Tolerance for floating point comparison in traversal analysis. Range: 0.001-1.0 */
    traversalTolerance: number;

    /** Maximum number of traversal attempts per chain. Range: 1-10 */
    maxTraversalAttempts: number;
}

export const DEFAULT_CHAIN_NORMALIZATION_PARAMETERS: ChainNormalizationParameters =
    {
        traversalTolerance: 0.01,
        maxTraversalAttempts: 5,
    };

/**
 * Join Co-linear Lines Parameters
 * Controls how collinear line segments are joined together
 */
export interface JoinColinearLinesParameters {
    /** Tolerance for determining if lines are collinear. Range: 0.001-1.0 */
    tolerance: number;
}

export const DEFAULT_JOIN_COLINEAR_LINES_PARAMETERS: JoinColinearLinesParameters =
    {
        tolerance: TOLERANCE,
    };

/**
 * Start Point Optimization Parameters
 * Controls how chain start points are optimized for cutting
 */
export interface StartPointOptimizationParameters {
    /** Position along the selected shape where to create the split. */
    splitPosition: 'midpoint';

    /** Tolerance for optimization operations. Range: 0.001-10 */
    tolerance: number;
}

export const DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS: StartPointOptimizationParameters =
    {
        splitPosition: 'midpoint',
        tolerance: 0.05,
    };

/**
 * Combined Algorithm Parameters
 * All algorithm parameters in a single interface for convenience
 */
export interface AlgorithmParameters {
    chainDetection: ChainDetectionParameters;
    chainNormalization: ChainNormalizationParameters;
    partDetection: PartDetectionParameters;
    joinColinearLines: JoinColinearLinesParameters;
    startPointOptimization: StartPointOptimizationParameters;
}

export const DEFAULT_ALGORITHM_PARAMETERS: AlgorithmParameters = {
    chainDetection: DEFAULT_CHAIN_DETECTION_PARAMETERS,
    chainNormalization: DEFAULT_CHAIN_NORMALIZATION_PARAMETERS,
    partDetection: DEFAULT_PART_DETECTION_PARAMETERS,
    joinColinearLines: DEFAULT_JOIN_COLINEAR_LINES_PARAMETERS,
    startPointOptimization: DEFAULT_START_POINT_OPTIMIZATION_PARAMETERS,
};
