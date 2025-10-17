import type { Point2D } from '$lib/geometry/point';

export interface Ellipse {
    center: Point2D;
    majorAxisEndpoint: Point2D; // Vector from center to end of major axis
    minorToMajorRatio: number; // Ratio of minor axis to major axis
    startParam?: number; // Start parameter for ellipse arcs (optional)
    endParam?: number; // End parameter for ellipse arcs (optional)
    // NOTE: DXF ellipse arcs always curve counter-clockwise from startParam to endParam
}

/**
 * Configuration options for ellipse tessellation
 */
export interface EllipseTessellationConfig {
    /** Number of points to generate for tessellation */
    numPoints: number;
    /** Whether to include the start point at the end for closed ellipses (default: false) */
    closePath?: boolean;
}
