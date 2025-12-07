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
