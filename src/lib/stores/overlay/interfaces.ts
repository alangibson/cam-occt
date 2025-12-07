import { WorkflowStage } from '$lib/stores/workflow/enums';

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

interface ToolHead {
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
