import type { GeometryType } from './enums';
import type {
    Geometry,
    GetShapePointsMode,
    GetShapePointsResolution,
} from './types';

export interface Shape {
    id: string;
    type: GeometryType;
    geometry: Geometry;
    layer?: string;
    originalType?: string; // Track original DXF entity type for converted shapes
    metadata?: Record<string, string | number | boolean | null>; // Metadata for additional shape information (e.g., originalLayer)
}
export interface GetShapePointsOptions {
    forNativeShapes?: boolean;
    mode?: GetShapePointsMode;
    resolution?: GetShapePointsResolution;
}
