import type { CutsState } from './interfaces';

class CutStore {
    showCutNormals = $state(false);
    showCutDirections = $state(false);
    showCutPaths = $state(true);
    showCutStartPoints = $state(false);
    showCutEndPoints = $state(false);
    showCutTangentLines = $state(false);

    setShowCutNormals(show: boolean) {
        this.showCutNormals = show;
    }

    setShowCutDirections(show: boolean) {
        this.showCutDirections = show;
    }

    setShowCutPaths(show: boolean) {
        this.showCutPaths = show;
    }

    setShowCutStartPoints(show: boolean) {
        this.showCutStartPoints = show;
    }

    setShowCutEndPoints(show: boolean) {
        this.showCutEndPoints = show;
    }

    setShowCutTangentLines(show: boolean) {
        this.showCutTangentLines = show;
    }

    reset() {
        this.showCutNormals = false;
        this.showCutDirections = false;
        this.showCutPaths = true;
        this.showCutStartPoints = false;
        this.showCutEndPoints = false;
        this.showCutTangentLines = false;
    }

    // Restore state from persistence (preserves IDs and calculated data)
    restore(cutsState: CutsState) {
        this.showCutNormals = cutsState.showCutNormals;
        this.showCutDirections = cutsState.showCutDirections;
        this.showCutPaths = cutsState.showCutPaths;
        this.showCutStartPoints = cutsState.showCutStartPoints;
        this.showCutEndPoints = cutsState.showCutEndPoints;
        this.showCutTangentLines = cutsState.showCutTangentLines;
    }
}

export const cutStore: CutStore = new CutStore();
