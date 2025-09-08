import type { Shape, Point2D } from '../../../../lib/types/geometry';

/**
 * Fill Types Module
 *
 * This module defines types for the gap filling system that extends offset shapes
 * to their intersection points, eliminating visible gaps in chain offsets.
 */

/**
 * Options for fill operations
 */
export interface FillOptions {
    /** Maximum distance to extend a shape */
    maxExtension: number;

    /** Geometric tolerance for calculations */
    tolerance: number;

    /** Preferred intersection point when multiple exist */
    preferredIntersection?: Point2D;

    /** Which end of the shape to extend ('start', 'end', or 'auto') */
    extendDirection?: 'start' | 'end' | 'auto';
}

/**
 * Result of a fill operation
 */
export interface FillResult {
    /** Whether the fill operation succeeded */
    success: boolean;

    /** The extended shape, or null if failed */
    extendedShape: Shape | null;

    /** Information about the extension applied */
    extension?: ShapeExtension;

    /** Point where the extension meets the intersection */
    intersectionPoint?: Point2D;

    /** Warnings encountered during filling */
    warnings: string[];

    /** Errors that prevented successful filling */
    errors: string[];

    /** Confidence in the fill result (0-1) */
    confidence: number;
}

/**
 * Information about how a shape was extended
 */
export interface ShapeExtension {
    /** Type of extension applied */
    type: 'linear' | 'angular' | 'parametric';

    /** Amount of extension in appropriate units */
    amount: number;

    /** Direction of extension */
    direction: 'start' | 'end' | 'both';

    /** Original shape before extension */
    originalShape: Shape;

    /** Point where extension begins */
    extensionStart: Point2D;

    /** Point where extension ends */
    extensionEnd: Point2D;
}

/**
 * Strategy for gap filling between two shapes
 */
export type FillStrategy =
    | 'extend-first' // Extend first shape to intersection
    | 'extend-second' // Extend second shape to intersection
    | 'extend-both' // Extend both shapes to intersection
    | 'insert-filler' // Insert connecting geometry
    | 'snap-endpoints'; // Move endpoints together

/**
 * Context information for gap filling operations
 */
export interface GapContext {
    /** The two shapes with a gap between them */
    shape1: Shape;
    shape2: Shape;

    /** Gap distance */
    gapSize: number;

    /** Location of the gap */
    gapLocation: {
        point1: Point2D; // Endpoint of shape1
        point2: Point2D; // Startpoint of shape2
    };

    /** Index positions in the chain */
    shape1Index: number;
    shape2Index: number;

    /** Whether this is in a closed chain */
    isClosedChain: boolean;
}
