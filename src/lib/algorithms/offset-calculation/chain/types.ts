import type { Point2D, Shape } from '$lib/types/geometry';
import type { IntersectionType } from '$lib/algorithms/offset-calculation/intersect/index';
import { MAX_EXTENSION } from '$lib/algorithms/constants';

// Re-export Shape type for use by other offset modules
export type { Shape };

/**
 * Chain Offset Types
 *
 * This module defines all types used in the chain offset system.
 * Chain offsetting generates offset shapes for all shapes in a chain,
 * trims them at intersections, and classifies them by their spatial
 * relationship to the original chain.
 */

/**
 * Parameters for chain offset operations
 */
export interface ChainOffsetParameters {
    /** Geometric tolerance for comparisons and snapping */
    tolerance: number;

    /** Maximum distance to extend shapes when filling gaps */
    maxExtension: number;

    /** Distance threshold below which endpoints are snapped together */
    snapThreshold: number;

    /** Whether to validate invariants during processing */
    validateInvariants?: boolean;

    /** Maximum iterations for intersection refinement */
    maxIterations?: number;

    /** Whether to detect and return intersection points within polylines */
    polylineIntersections?: boolean;

    /** Type of intersections to detect: 'true' for segment crossings only, 'infinite' for extended line intersections */
    intersectionType?: IntersectionType;
}

/**
 * Default parameters for chain offset operations
 */
export const DEFAULT_CHAIN_OFFSET_PARAMETERS: ChainOffsetParameters = {
    tolerance: 0.05,
    maxExtension: MAX_EXTENSION,
    snapThreshold: 0.1,
    validateInvariants: true,
    maxIterations: 100,
    polylineIntersections: false,
    intersectionType: 'infinite',
};

/**
 * Represents which side of the chain an offset is on
 * - For closed chains: 'inner' or 'outer'
 * - For open chains: 'left' or 'right'
 */
export type OffsetSide = 'inner' | 'outer' | 'left' | 'right';

/**
 * Represents a continuous offset chain derived from shape offsets
 */
export interface OffsetChain {
    /** Unique identifier for this offset chain */
    id: string;

    /** ID of the original chain this was offset from */
    originalChainId: string;

    /** Which side of the original chain this offset is on */
    side: OffsetSide;

    /** Ordered list of shapes forming the offset chain */
    shapes: Shape[];

    /** Whether this offset chain forms a closed loop */
    closed: boolean;

    /** Whether all shapes connect properly within tolerance */
    continuous: boolean;

    /** Any gaps that were filled during processing */
    gapFills?: GapFillingResult[];

    /** Any overlaps that were trimmed during processing */
    trimPoints?: TrimPoint[];

    /** All intersection points found during processing (for debugging/visualization) */
    intersectionPoints?: IntersectionResult[];
}

/**
 * Result of the chain offset operation
 */
export interface ChainOffsetResult {
    /** Whether the operation completed successfully */
    success: boolean;

    /** Inner offset chain (for closed chains) or left chain (for open chains) */
    innerChain?: OffsetChain;

    /** Outer offset chain (for closed chains) or right chain (for open chains) */
    outerChain?: OffsetChain;

    /** Non-fatal issues encountered during processing */
    warnings: string[];

    /** Fatal errors that prevented completion */
    errors: string[];

    /** Performance metrics */
    metrics?: {
        totalShapes: number;
        intersectionsFound: number;
        gapsFilled: number;
        processingTimeMs: number;
    };
}

/**
 * Result of intersection detection between two shapes or within a single shape
 *
 * This interface is used for:
 * - Intersections between different shapes in a chain
 * - Self-intersections within individual polyline shapes
 * - Any geometric intersection analysis in the offset system
 */
export interface IntersectionResult {
    /** The intersection point in 2D space */
    point: Point2D;

    /** Parameter value on the first shape (0-1 for most shapes) */
    param1: number;

    /** Parameter value on the second shape (0-1 for most shapes) */
    param2: number;

    /** Distance between the shapes at closest approach (0 for exact intersection) */
    distance: number;

    /** Type of intersection */
    type: 'exact' | 'approximate' | 'tangent' | 'coincident';

    /** Confidence in the intersection (0-1, based on numerical accuracy) */
    confidence: number;

    /** Whether the intersection occurs on an extended portion of either shape */
    onExtension?: boolean;
}

/**
 * Type alias for self-intersection results within polylines
 *
 * Self-intersections occur when a polyline crosses itself. In this context:
 * - param1 and param2 represent parameters on the same polyline
 * - The intersection represents where the polyline crosses its own path
 */
export type PolylineSelfIntersection = IntersectionResult;

/**
 * Methods used for filling gaps between shapes
 */
export type GapFillingMethod =
    | 'snap' // Endpoints snapped together (very small gaps)
    | 'extend' // Shape extended to meet (lines, arcs)
    | 'fillet' // Arc inserted to connect endpoints
    | 'line' // Straight line inserted
    | 'none'; // No fill needed

/**
 * Result of gap filling operation
 */
export interface GapFillingResult {
    /** Method used to fill the gap */
    method: GapFillingMethod;

    /** New shape created to fill the gap (if any) */
    fillerShape?: Shape;

    /** Shapes that were modified during gap filling */
    modifiedShapes: {
        original: Shape;
        modified: Shape;
    }[];

    /** Size of the gap that was filled */
    gapSize: number;

    /** Location of the gap */
    gapLocation: {
        shape1Index: number;
        shape2Index: number;
        point: Point2D;
    };
}

/**
 * Information about a trimming operation
 */
export interface TrimPoint {
    /** Where the trim occurred */
    point: Point2D;

    /** Indices of shapes that were trimmed */
    shape1Index: number;
    shape2Index: number;

    /** How much was trimmed from each shape */
    trim1Amount: number;
    trim2Amount: number;

    /** Type of corner created */
    cornerType: 'sharp' | 'tangent' | 'rounded';
}

/**
 * Options for side detection
 */
export interface SideDetectionOptions {
    /** Use winding number algorithm for closed chains */
    useWindingNumber?: boolean;

    /** Number of sample points for side detection */
    sampleCount?: number;

    /** Offset distance for normal-based detection */
    normalOffset?: number;
}

/**
 * Result of side detection for an offset shape
 */
export interface SideDetectionResult {
    /** Detected side */
    side: OffsetSide;

    /** Confidence in the detection (0-1) */
    confidence: number;

    /** Method used for detection */
    method: 'winding' | 'normal' | 'orientation';
}

/**
 * Chain analysis result for offset planning
 */
export interface ChainAnalysis {
    /** Whether the chain is closed */
    isClosed: boolean;

    /** Total length of the chain */
    totalLength: number;

    /** Bounding box of the chain */
    bounds: {
        min: Point2D;
        max: Point2D;
    };

    /** Sharp corners that need special handling */
    sharpCorners: {
        index: number;
        angle: number;
        point: Point2D;
    }[];

    /** Suggested offset strategy */
    strategy: 'simple' | 'complex' | 'critical';
}
