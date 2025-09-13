import type { BoundingBox } from '$lib/geometry/bounding-box';
import { Unit } from '../../utils/units';
import type { GeometryType } from './enums';
import type { Geometry } from './types';

export interface Shape {
    id: string;
    type: GeometryType;
    geometry: Geometry;
    layer?: string;
    originalType?: string; // Track original DXF entity type for converted shapes
    metadata?: Record<string, unknown>; // Metadata for additional shape information (e.g., originalLayer)
}

export interface Layer {
    shapes: Shape[];
    name?: string;
    visible?: boolean;
    color?: string;
}

export interface Drawing {
    shapes: Shape[];
    bounds: BoundingBox;
    units: Unit;
    layers?: Record<string, Layer>; // Optional layer-based shape organization
}
