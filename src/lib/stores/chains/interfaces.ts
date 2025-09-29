import type { Chain } from '$lib/geometry/chain/interfaces';

export interface ChainStore {
    chains: Chain[];
    tolerance: number;
    selectedChainId: string | null;
    highlightedChainId: string | null;

    // Chain visualization options
    showChainStartPoints: boolean;
    showChainEndPoints: boolean;
    showChainTangentLines: boolean;
}
