import type { Point2D } from '$lib/geometry/point/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';

/**
 * Represents which side of the chain an offset is on
 * - For closed chains: 'inner' or 'outer'
 * - For open chains: 'left' or 'right'
 */

type OffsetSide = 'inner' | 'outer' | 'left' | 'right';

/**
 * Direction for offset operation
 */
export enum OffsetDirection {
    NONE = 'none',
    INSET = 'inset',
    OUTSET = 'outset',
}

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
    shapes: ShapeData[];

    /** Whether this offset chain forms a closed loop */
    closed: boolean;

    /** Whether all shapes connect properly within tolerance */
    continuous: boolean;

    /** Any overlaps that were trimmed during processing */
    trimPoints?: TrimPoint[];

    /** All intersection points found during processing (for debugging/visualization) */
    intersectionPoints?: IntersectionResult[];
}

/**
 * Information about a trimming operation
 */
interface TrimPoint {
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
 * Parameters for chain offset operations
 */
export interface ChainOffsetParameters {
    /** Geometric tolerance for comparisons and snapping */
    tolerance: number;

    /** Maximum distance to extend shapes when filling gaps (not used by Clipper2) */
    maxExtension?: number;

    /** Distance threshold below which endpoints are snapped together (not used by Clipper2) */
    snapThreshold?: number;

    /** Whether to validate invariants during processing */
    validateInvariants?: boolean;

    /** Maximum iterations for intersection refinement */
    maxIterations?: number;

    /** Whether to detect and return intersection points within polylines */
    polylineIntersections?: boolean;
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
