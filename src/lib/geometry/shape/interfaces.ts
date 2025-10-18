import type { GeometryType } from './enums';
import type { Geometry } from './types';

export interface Shape {
    id: string;
    type: GeometryType;
    geometry: Geometry;
    layer?: string;
    originalType?: string; // Track original DXF entity type for converted shapes
    metadata?: Record<string, string | number | boolean | null>; // Metadata for additional shape information (e.g., originalLayer)
}
