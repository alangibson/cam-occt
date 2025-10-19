import type { Unit } from '$lib/config/units/units';
import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import type { Shape } from '$lib/geometry/shape/interfaces';
import type { Layer } from '$lib/cam/layer/interfaces';

export interface Drawing {
    shapes: Shape[];
    bounds: BoundingBox;
    units: Unit;
    layers?: Record<string, Layer>; // Optional layer-based shape organization
}
