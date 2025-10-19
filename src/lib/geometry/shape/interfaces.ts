import type { GeometryType } from './enums';
import type {
    Geometry,
    GetShapePointsMode,
    GetShapePointsResolution,
} from './types';
import type { Point2D } from '$lib/geometry/point/interfaces';

/**
 * Cached tessellation data for rendering optimization
 */
export interface TessellationCache {
    points: Point2D[];
    tolerance: number;
    timestamp: number; // For cache invalidation if needed
}

export interface Shape {
    id: string;
    type: GeometryType;
    geometry: Geometry;
    layer?: string;
    originalType?: string; // Track original DXF entity type for converted shapes
    metadata?: Record<string, string | number | boolean | null>; // Metadata for additional shape information (e.g., originalLayer)
    tessellationCache?: TessellationCache; // Internal cache for expensive tessellations (splines, ellipses)
}
export interface GetShapePointsOptions {
    forNativeShapes?: boolean;
    mode?: GetShapePointsMode;
    resolution?: GetShapePointsResolution;
}
