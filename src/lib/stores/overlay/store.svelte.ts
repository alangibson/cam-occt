/**
 * Drawing Overlay Store
 * Manages stage-specific visual overlays that are displayed on top of the drawing
 */

import { WorkflowStage } from '$lib/stores/workflow/enums';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type {
    OverlayState,
    DrawingOverlay,
    ShapePoint,
    ChainEndpoint,
    TessellationPoint,
} from './interfaces';

/**
 * Creates an empty overlay for a given stage
 */
function createEmptyOverlay(stage: WorkflowStage): DrawingOverlay {
    return {
        stage,
        shapePoints: [],
        chainEndpoints: [],
        tessellationPoints: [],
    };
}

/**
 * Creates the default overlays record for all workflow stages
 */
function createDefaultOverlays(): Record<WorkflowStage, DrawingOverlay> {
    return {
        [WorkflowStage.IMPORT]: createEmptyOverlay(WorkflowStage.IMPORT),
        [WorkflowStage.PROGRAM]: createEmptyOverlay(WorkflowStage.PROGRAM),
        [WorkflowStage.SIMULATE]: createEmptyOverlay(WorkflowStage.SIMULATE),
        [WorkflowStage.EXPORT]: createEmptyOverlay(WorkflowStage.EXPORT),
    };
}

class SimulationStore {
    currentStage = $state<WorkflowStage>(WorkflowStage.IMPORT);
    overlays = $state<Record<WorkflowStage, DrawingOverlay>>(
        createDefaultOverlays()
    );

    // Set the current workflow stage
    setCurrentStage(stage: WorkflowStage) {
        this.currentStage = stage;
    }

    // Get overlay for current stage
    getCurrentOverlay(): DrawingOverlay {
        return this.overlays[this.currentStage];
    }

    // Shape points management (Edit stage)
    setShapePoints(stage: WorkflowStage, points: ShapePoint[]) {
        this.overlays[stage] = {
            ...this.overlays[stage],
            shapePoints: points,
        };
    }

    clearShapePoints(stage: WorkflowStage) {
        this.overlays[stage] = {
            ...this.overlays[stage],
            shapePoints: [],
        };
    }

    // Chain endpoints management (Prepare stage)
    setChainEndpoints(stage: WorkflowStage, endpoints: ChainEndpoint[]) {
        this.overlays[stage] = {
            ...this.overlays[stage],
            chainEndpoints: endpoints,
        };
    }

    clearChainEndpoints(stage: WorkflowStage) {
        this.overlays[stage] = {
            ...this.overlays[stage],
            chainEndpoints: [],
        };
    }

    // Tessellation points management (Program stage)
    setTessellationPoints(stage: WorkflowStage, points: TessellationPoint[]) {
        this.overlays[stage] = {
            ...this.overlays[stage],
            tessellationPoints: points,
        };
    }

    clearTessellationPoints(stage: WorkflowStage) {
        this.overlays[stage] = {
            ...this.overlays[stage],
            tessellationPoints: [],
        };
    }

    // Tool head management (Simulate stage)
    setToolHead(stage: WorkflowStage, position: Point2D) {
        this.overlays[stage] = {
            ...this.overlays[stage],
            toolHead: {
                x: position.x,
                y: position.y,
                visible: true,
            },
        };
    }

    clearToolHead(stage: WorkflowStage) {
        this.overlays[stage] = {
            ...this.overlays[stage],
            toolHead: undefined,
        };
    }

    // Clear all overlays for a stage
    clearStageOverlay(stage: WorkflowStage) {
        this.overlays[stage] = {
            stage,
            shapePoints: [],
            chainEndpoints: [],
            tessellationPoints: [],
        };
    }

    // Clear all overlays
    clearAllOverlays() {
        this.overlays = createDefaultOverlays();
    }

    // Restore state from persistence
    restore(state: OverlayState) {
        this.currentStage = state.currentStage;
        this.overlays = state.overlays;
    }
}

export const overlayStore = new SimulationStore();
