import type { ShapeData } from '$lib/geometry/shape/interfaces';

export interface LayerData {
    shapes: ShapeData[];
    name?: string;
}
