/**
 * Drawing Overlay Store
 * Manages stage-specific visual overlays that are displayed on top of the drawing
 */

import { writable } from 'svelte/store';
import { WorkflowStage } from '../workflow/enums';
import type { Point2D } from '$lib/types';
import type {
    OverlayState,
    DrawingOverlay,
    ShapePoint,
    ChainEndpoint,
    TessellationPoint,
    OverlayStore,
} from './interfaces';

function createOverlayStore(): OverlayStore {
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
