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
