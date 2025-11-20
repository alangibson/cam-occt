import type { Shape } from '$lib/geometry/shape/interfaces';

export interface LayerData {
    shapes: Shape[];
    name?: string;
    visible?: boolean;
    color?: string;
}
