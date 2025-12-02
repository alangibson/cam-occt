export interface ChainStore {
    tolerance: number;

    // Chain visualization options
    showChainPaths: boolean;
    showChainStartPoints: boolean;
    showChainEndPoints: boolean;
    showChainTangentLines: boolean;
    showChainNormals: boolean;
    showChainDirections: boolean;
    showChainTessellation: boolean;
}
