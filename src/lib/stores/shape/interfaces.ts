/**
 * Shape Store Interfaces
 *
 * Type definitions for the Shape store that manages shape visualization preferences.
 */

export interface ShapeVisualizationState {
    // Shape visualization options
    showShapePaths: boolean;
    showShapeStartPoints: boolean;
    showShapeEndPoints: boolean;
    showShapeNormals: boolean;
    showShapeWindingDirection: boolean;
    showShapeTangentLines: boolean;
    showShapeTessellation: boolean;
}

export interface ShapeVisualizationStore {
    subscribe: (run: (value: ShapeVisualizationState) => void) => () => void;
    setShowShapePaths: (show: boolean) => void;
    setShowShapeStartPoints: (show: boolean) => void;
    setShowShapeEndPoints: (show: boolean) => void;
    setShowShapeNormals: (show: boolean) => void;
    setShowShapeWindingDirection: (show: boolean) => void;
    setShowShapeTangentLines: (show: boolean) => void;
    setShowShapeTessellation: (show: boolean) => void;
    reset: () => void;
}
