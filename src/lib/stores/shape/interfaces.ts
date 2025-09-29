/**
 * Shape Store Interfaces
 *
 * Type definitions for the Shape store that manages shape visualization preferences.
 */

export interface ShapeVisualizationState {
    // Shape visualization options
    showShapeStartPoints: boolean;
    showShapeEndPoints: boolean;
}

export interface ShapeVisualizationStore {
    subscribe: (run: (value: ShapeVisualizationState) => void) => () => void;
    setShowShapeStartPoints: (show: boolean) => void;
    setShowShapeEndPoints: (show: boolean) => void;
    reset: () => void;
}