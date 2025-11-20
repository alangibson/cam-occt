export interface ChainStore {
    tolerance: number;
    selectedChainIds: Set<string>;
    highlightedChainId: string | null;

    // Chain visualization options
    showChainPaths: boolean;
    showChainStartPoints: boolean;
    showChainEndPoints: boolean;
    showChainTangentLines: boolean;
    showChainNormals: boolean;
    showChainDirections: boolean;
    showChainTessellation: boolean;
}
