import type { Point2D } from '$lib/types';
import { WorkflowStage } from '../workflow/enums';

export interface TessellationPoint {
    x: number;
    y: number;
    shapeId: string;
    chainId: string;
}

export interface ShapePoint {
    x: number;
    y: number;
    type: 'origin' | 'start' | 'end';
    shapeId: string;
}

export interface ChainEndpoint {
    x: number;
    y: number;
    type: 'start' | 'end';
    chainId: string;
}

export interface ToolHead {
    x: number;
    y: number;
    visible: boolean;
}

export interface DrawingOverlay {
    stage: WorkflowStage;
    shapePoints: ShapePoint[];
    chainEndpoints: ChainEndpoint[];
    tessellationPoints: TessellationPoint[];
    toolHead?: ToolHead;
}

export interface OverlayState {
    currentStage: WorkflowStage;
    overlays: Record<WorkflowStage, DrawingOverlay>;
}

export interface OverlayStore {
    subscribe: (run: (value: OverlayState) => void) => () => void;
    setCurrentStage: (stage: WorkflowStage) => void;
    getCurrentOverlay: () => DrawingOverlay | null;
    setShapePoints: (stage: WorkflowStage, points: ShapePoint[]) => void;
    clearShapePoints: (stage: WorkflowStage) => void;
    setChainEndpoints: (
        stage: WorkflowStage,
        endpoints: ChainEndpoint[]
    ) => void;
    clearChainEndpoints: (stage: WorkflowStage) => void;
    setTessellationPoints: (
        stage: WorkflowStage,
        points: TessellationPoint[]
    ) => void;
    clearTessellationPoints: (stage: WorkflowStage) => void;
    setToolHead: (stage: WorkflowStage, position: Point2D) => void;
    clearToolHead: (stage: WorkflowStage) => void;
    clearStageOverlay: (stage: WorkflowStage) => void;
    clearAllOverlays: () => void;
}
