/**
 * Shape Visualization Store
 *
 * Manages shape visualization preferences (start/end points) across all workflow stages.
 */

import type { ShapeVisualizationState } from './interfaces';

class ShapeStore {
    showShapePaths = $state(false);
    showShapeStartPoints = $state(false);
    showShapeEndPoints = $state(false);
    showShapeNormals = $state(false);
    showShapeWindingDirection = $state(false);
    showShapeTangentLines = $state(false);
    showShapeTessellation = $state(false);

    /**
     * Set shape paths visibility
     */
    setShowShapePaths(show: boolean) {
        this.showShapePaths = show;
    }

    /**
     * Set shape start points visibility
     */
    setShowShapeStartPoints(show: boolean) {
        this.showShapeStartPoints = show;
    }

    /**
     * Set shape end points visibility
     */
    setShowShapeEndPoints(show: boolean) {
        this.showShapeEndPoints = show;
    }

    /**
     * Set shape normals visibility
     */
    setShowShapeNormals(show: boolean) {
        this.showShapeNormals = show;
    }

    /**
     * Set shape winding direction visibility
     */
    setShowShapeWindingDirection(show: boolean) {
        this.showShapeWindingDirection = show;
    }

    /**
     * Set shape tangent lines visibility
     */
    setShowShapeTangentLines(show: boolean) {
        this.showShapeTangentLines = show;
    }

    /**
     * Set shape tessellation visibility
     */
    setShowShapeTessellation(show: boolean) {
        this.showShapeTessellation = show;
    }

    /**
     * Reset to defaults
     */
    reset() {
        this.showShapePaths = false;
        this.showShapeStartPoints = false;
        this.showShapeEndPoints = false;
        this.showShapeNormals = false;
        this.showShapeWindingDirection = false;
        this.showShapeTangentLines = false;
        this.showShapeTessellation = false;
    }

    /**
     * Restore from saved state
     */
    restore(state: ShapeVisualizationState) {
        this.showShapePaths = state.showShapePaths;
        this.showShapeStartPoints = state.showShapeStartPoints;
        this.showShapeEndPoints = state.showShapeEndPoints;
        this.showShapeNormals = state.showShapeNormals;
        this.showShapeWindingDirection = state.showShapeWindingDirection;
        this.showShapeTangentLines = state.showShapeTangentLines;
        this.showShapeTessellation = state.showShapeTessellation;
    }
}

export const shapeVisualizationStore = new ShapeStore();
