import type { ShapeData } from '$lib/cam/shape/interfaces';

export interface LayerData {
    shapes: ShapeData[];
    name?: string;
}
