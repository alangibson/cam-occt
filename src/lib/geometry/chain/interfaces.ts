import type { Shape } from '$lib/geometry/shape/interfaces';

export interface Chain {
    id: string;
    shapes: Shape[];
    clockwise?: boolean | null; // true=clockwise, false=counterclockwise, null=open chain, undefined=not analyzed
    originalChainId?: string; // For offset chains, reference to the original chain ID for part lookup
}
