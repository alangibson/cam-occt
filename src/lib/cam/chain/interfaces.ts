import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { Chain } from './classes.svelte';

export interface ChainData {
    id: string;
    name: string;
    shapes: ShapeData[];
    clockwise?: boolean | null; // true=clockwise, false=counterclockwise, null=open chain, undefined=not analyzed
    originalChainId?: string; // For offset chains, reference to the original chain ID for part lookup
}

/**
 * Result of creating a cut chain with execution ordering
 */
export interface CutChainResult {
    /** The cut chain with shapes ordered for execution */
    cutChain: Chain;
    /** The execution winding direction (true=clockwise, false=counterclockwise, null=none) */
    executionClockwise: boolean | null;
}
