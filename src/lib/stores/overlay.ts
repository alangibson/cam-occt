/**
 * Drawing Overlay Store
 * Manages stage-specific visual overlays that are displayed on top of the drawing
 */

import { writable } from 'svelte/store';
import { WorkflowStage } from './workflow';
import type {
    Circle,
    Ellipse,
    Line,
    Point2D,
    Polyline,
    Shape,
} from '$lib/types';
import type { Arc } from '$lib/geometry/arc';
import type { Chain } from '$lib/geometry/chain/interfaces';
import {
    getShapeEndPoint,
    getShapeStartPoint,
} from '$lib/geometry/shape/functions';
import { polylineToPoints } from '$lib/geometry/polyline';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';

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

function createOverlayStore(): {
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
} {
    const initialState: OverlayState = {
        currentStage: WorkflowStage.IMPORT,
        overlays: {
            import: {
                stage: WorkflowStage.IMPORT,
                shapePoints: [],
                chainEndpoints: [],
                tessellationPoints: [],
            },
            edit: {
                stage: WorkflowStage.EDIT,
                shapePoints: [],
                chainEndpoints: [],
                tessellationPoints: [],
            },
            prepare: {
                stage: WorkflowStage.PREPARE,
                shapePoints: [],
                chainEndpoints: [],
                tessellationPoints: [],
            },
            program: {
                stage: WorkflowStage.PROGRAM,
                shapePoints: [],
                chainEndpoints: [],
                tessellationPoints: [],
            },
            simulate: {
                stage: WorkflowStage.SIMULATE,
                shapePoints: [],
                chainEndpoints: [],
                tessellationPoints: [],
            },
            export: {
                stage: WorkflowStage.EXPORT,
                shapePoints: [],
                chainEndpoints: [],
                tessellationPoints: [],
            },
        },
    };

    const { subscribe, update } = writable<OverlayState>(initialState);

    return {
        subscribe,

        // Set the current workflow stage
        setCurrentStage: (stage: WorkflowStage) => {
            update((state) => ({
                ...state,
                currentStage: stage,
            }));
        },

        // Get overlay for current stage
        getCurrentOverlay: () => {
            let currentOverlay: DrawingOverlay | null = null;
            update((state) => {
                currentOverlay = state.overlays[state.currentStage];
                return state;
            });
            return currentOverlay;
        },

        // Shape points management (Edit stage)
        setShapePoints: (stage: WorkflowStage, points: ShapePoint[]) => {
            update((state) => ({
                ...state,
                overlays: {
                    ...state.overlays,
                    [stage]: {
                        ...state.overlays[stage],
                        shapePoints: points,
                    },
                },
            }));
        },

        clearShapePoints: (stage: WorkflowStage) => {
            update((state) => ({
                ...state,
                overlays: {
                    ...state.overlays,
                    [stage]: {
                        ...state.overlays[stage],
                        shapePoints: [],
                    },
                },
            }));
        },

        // Chain endpoints management (Prepare stage)
        setChainEndpoints: (
            stage: WorkflowStage,
            endpoints: ChainEndpoint[]
        ) => {
            update((state) => ({
                ...state,
                overlays: {
                    ...state.overlays,
                    [stage]: {
                        ...state.overlays[stage],
                        chainEndpoints: endpoints,
                    },
                },
            }));
        },

        clearChainEndpoints: (stage: WorkflowStage) => {
            update((state) => ({
                ...state,
                overlays: {
                    ...state.overlays,
                    [stage]: {
                        ...state.overlays[stage],
                        chainEndpoints: [],
                    },
                },
            }));
        },

        // Tessellation points management (Program stage)
        setTessellationPoints: (
            stage: WorkflowStage,
            points: TessellationPoint[]
        ) => {
            update((state) => ({
                ...state,
                overlays: {
                    ...state.overlays,
                    [stage]: {
                        ...state.overlays[stage],
                        tessellationPoints: points,
                    },
                },
            }));
        },

        clearTessellationPoints: (stage: WorkflowStage) => {
            update((state) => ({
                ...state,
                overlays: {
                    ...state.overlays,
                    [stage]: {
                        ...state.overlays[stage],
                        tessellationPoints: [],
                    },
                },
            }));
        },

        // Tool head management (Simulate stage)
        setToolHead: (stage: WorkflowStage, position: Point2D) => {
            update((state) => ({
                ...state,
                overlays: {
                    ...state.overlays,
                    [stage]: {
                        ...state.overlays[stage],
                        toolHead: {
                            x: position.x,
                            y: position.y,
                            visible: true,
                        },
                    },
                },
            }));
        },

        clearToolHead: (stage: WorkflowStage) => {
            update((state) => ({
                ...state,
                overlays: {
                    ...state.overlays,
                    [stage]: {
                        ...state.overlays[stage],
                        toolHead: undefined,
                    },
                },
            }));
        },

        // Clear all overlays for a stage
        clearStageOverlay: (stage: WorkflowStage) => {
            update((state) => ({
                ...state,
                overlays: {
                    ...state.overlays,
                    [stage]: {
                        stage,
                        shapePoints: [],
                        chainEndpoints: [],
                        tessellationPoints: [],
                    },
                },
            }));
        },

        // Clear all overlays
        clearAllOverlays: () => {
            update((state) => ({
                ...state,
                overlays: Object.keys(state.overlays).reduce(
                    (acc, stage) => {
                        acc[stage as WorkflowStage] = {
                            stage: stage as WorkflowStage,
                            shapePoints: [],
                            chainEndpoints: [],
                            tessellationPoints: [],
                        };
                        return acc;
                    },
                    {} as Record<WorkflowStage, DrawingOverlay>
                ),
            }));
        },
    };
}

export const overlayStore: ReturnType<typeof createOverlayStore> =
    createOverlayStore();

// Helper functions to generate overlay data
export function generateShapePoints(
    shapes: Shape[],
    selectedShapeIds: Set<string>
): ShapePoint[] {
    const points: ShapePoint[] = [];

    shapes.forEach((shape) => {
        if (selectedShapeIds.has(shape.id)) {
            // Generate origin, start, and end points for selected shapes
            const origin: Point2D | null = getShapeOrigin(shape);
            const start: Point2D = getShapeStartPoint(shape);
            const end: Point2D = getShapeEndPoint(shape);

            if (origin) {
                points.push({ ...origin, type: 'origin', shapeId: shape.id });
            }
            points.push({ ...start, type: 'start', shapeId: shape.id });
            points.push({ ...end, type: 'end', shapeId: shape.id });
        }
    });

    return points;
}

export function generateChainEndpoints(chains: Chain[]): ChainEndpoint[] {
    const endpoints: ChainEndpoint[] = [];

    chains.forEach((chain) => {
        if (chain.shapes.length === 0) return;

        const firstShape: Shape = chain.shapes[0];
        const lastShape: Shape = chain.shapes[chain.shapes.length - 1];

        const start: Point2D = getShapeStartPoint(firstShape);
        const end: Point2D = getShapeEndPoint(lastShape);

        endpoints.push({ ...start, type: 'start', chainId: chain.id });

        if (
            Math.abs(end.x - start.x) > CHAIN_CLOSURE_TOLERANCE ||
            Math.abs(end.y - start.y) > CHAIN_CLOSURE_TOLERANCE
        ) {
            endpoints.push({ ...end, type: 'end', chainId: chain.id });
        }
    });

    return endpoints;
}

// Temporary helper functions - these should be moved to a shared utilities file
function getShapeOrigin(shape: Shape): Point2D | null {
    switch (shape.type) {
        case 'line':
            const line: import('$lib/types/geometry').Line =
                shape.geometry as Line;
            return line.start;
        case 'circle':
        case 'arc':
            const circle: import('$lib/types/geometry').Circle =
                shape.geometry as Circle | Arc;
            return circle.center;
        case 'polyline':
            const polyline: import('$lib/types/geometry').Polyline =
                shape.geometry as Polyline;
            const points: Point2D[] = polylineToPoints(polyline);
            return points.length > 0 ? points[0] : null;
        case 'ellipse':
            const ellipse: import('$lib/types/geometry').Ellipse =
                shape.geometry as Ellipse;
            return ellipse.center;
        default:
            return null;
    }
}
