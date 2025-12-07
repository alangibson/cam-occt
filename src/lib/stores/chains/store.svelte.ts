class ChainStore {
    tolerance = $state(0.1);
    showChainPaths = $state(true);
    showChainStartPoints = $state(false);
    showChainEndPoints = $state(false);
    showChainTangentLines = $state(false);
    showChainNormals = $state(false);
    showChainDirections = $state(false);
    showChainTessellation = $state(false);

    setTolerance(tolerance: number) {
        this.tolerance = tolerance;
    }

    setShowChainStartPoints(show: boolean) {
        this.showChainStartPoints = show;
    }

    setShowChainEndPoints(show: boolean) {
        this.showChainEndPoints = show;
    }

    setShowChainTangentLines(show: boolean) {
        this.showChainTangentLines = show;
    }

    setShowChainNormals(show: boolean) {
        this.showChainNormals = show;
    }

    setShowChainDirections(show: boolean) {
        this.showChainDirections = show;
    }

    setShowChainPaths(show: boolean) {
        this.showChainPaths = show;
    }

    setShowChainTessellation(show: boolean) {
        this.showChainTessellation = show;
    }
}

export const chainStore: ChainStore = new ChainStore();
