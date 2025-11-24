import type { GetShapePointsMode, GetShapePointsResolution } from './types';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Geometry } from '$lib/geometry/types';
import type { GeometryType } from '$lib/geometry/enums';

/**
 * Cached tessellation data for rendering optimization
 */
export interface TessellationCache {
    points: Point2D[];
    tolerance: number;
    timestamp: number; // For cache invalidation if needed
}

export interface GetShapePointsOptions {
    forNativeShapes?: boolean;
    mode?: GetShapePointsMode;
    resolution?: GetShapePointsResolution;
}

export interface ShapeData {
    id: string;
    type: GeometryType;
    geometry: Geometry;
    layer?: string;
}
