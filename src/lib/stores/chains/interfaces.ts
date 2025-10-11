import type { Chain } from '$lib/geometry/chain/interfaces';

export interface ChainStore {
    chains: Chain[];
    tolerance: number;
    selectedChainId: string | null;
    highlightedChainId: string | null;

    // Chain visualization options
    showChainPaths: boolean;
    showChainStartPoints: boolean;
    showChainEndPoints: boolean;
    showChainTangentLines: boolean;
    showChainNormals: boolean;
    showChainDirections: boolean;
}
