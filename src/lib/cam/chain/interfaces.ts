import type { ShapeData } from '$lib/cam/shape/interfaces';

export interface ChainData {
    id: string;
    name: string;
    shapes: ShapeData[];
    clockwise?: boolean | null; // true=clockwise, false=counterclockwise, null=open chain, undefined=not analyzed
    originalChainId?: string; // For offset chains, reference to the original chain ID for part lookup
}
