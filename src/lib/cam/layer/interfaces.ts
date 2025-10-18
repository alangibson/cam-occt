import type { Shape } from '$lib/geometry/shape/interfaces';

export interface Layer {
    shapes: Shape[];
    name?: string;
    visible?: boolean;
    color?: string;
}
