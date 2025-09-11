import { writable } from 'svelte/store';
import type { Point2D, Shape } from '$lib/types';
import { WorkflowStage, workflowStore } from './workflow';
import { CutDirection, LeadType } from '$lib/types/direction';
import { OffsetDirection } from '../algorithms/offset-calculation/offset/types';
import type { GapFillingResult } from '../algorithms/offset-calculation/chain/types';
import type { Chain } from '$lib/geometry/chain/interfaces';

export interface Path {
    id: string;
    name: string;
    operationId: string; // Reference to the operation that created this path
    chainId: string; // Reference to the source chain
    toolId: string | null; // Reference to the tool used
    enabled: boolean;
    order: number; // Execution order within operation
    cutDirection: CutDirection; // User-defined cut direction from operation
    feedRate?: number; // Cutting speed
    pierceHeight?: number; // Height for pierce operation
    pierceDelay?: number; // Delay for pierce operation
    arcVoltage?: number; // Arc voltage for plasma cutting
    kerfWidth?: number; // Kerf compensation width
    thcEnabled?: boolean; // Torch height control
    leadInLength?: number; // Lead-in length
    leadInType?: LeadType; // Lead-in type
    leadInFlipSide?: boolean; // Flip which side of the chain the lead-in is on
    leadInAngle?: number; // Manual rotation angle for lead-in (degrees, 0-360)
    leadInFit?: boolean; // Whether to automatically adjust lead-in length to avoid solid areas
    leadOutLength?: number; // Lead-out length
    leadOutType?: LeadType; // Lead-out type
    leadOutFlipSide?: boolean; // Flip which side of the chain the lead-out is on
    leadOutAngle?: number; // Manual rotation angle for lead-out (degrees, 0-360)
    leadOutFit?: boolean; // Whether to automatically adjust lead-out length to avoid solid areas
    overcutLength?: number; // Overcut length
    isHole?: boolean; // Whether this path is a hole (for velocity reduction)
    holeUnderspeedPercent?: number; // Velocity percentage for hole cutting (10-100)

    // Execution direction (independent of underlying chain's natural winding)
    executionClockwise?: boolean | null; // true=clockwise execution, false=counterclockwise, null=no direction (open chains)

    // Cut chain - cloned chain with shapes reordered for user-specified cut direction
    cutChain?: Chain; // Cloned chain with shapes ordered for execution direction

    // Calculated lead geometry (persisted to avoid recalculation)
    calculatedLeadIn?: {
        points: Point2D[];
        type: LeadType;
        generatedAt: string; // ISO timestamp
        version: string; // Algorithm version for invalidation
    };
    calculatedLeadOut?: {
        points: Point2D[];
        type: LeadType;
        generatedAt: string; // ISO timestamp
        version: string; // Algorithm version for invalidation
    };

    // Lead validation results (persisted)
    leadValidation?: {
        isValid: boolean;
        warnings: string[];
        errors: string[];
        severity: 'info' | 'warning' | 'error';
        validatedAt: string; // ISO timestamp
    };

    // Kerf compensation fields
    kerfCompensation?: OffsetDirection; // Direction of kerf compensation

    // Calculated offset geometry (persisted to avoid recalculation)
    calculatedOffset?: {
        offsetShapes: Shape[]; // The offset chain shapes
        originalShapes: Shape[]; // The original unmodified chain shapes
        direction: OffsetDirection; // The direction that was applied
        kerfWidth: number; // The kerf width used for calculation
        generatedAt: string; // ISO timestamp
        version: string; // Algorithm version for invalidation
        gapFills?: GapFillingResult[];
    };
}

export interface PathsState {
    paths: Path[];
    selectedPathId: string | null;
    highlightedPathId: string | null;
}

// Helper function to check if program stage should be completed
function checkProgramStageCompletion(paths: Path[]) {
    if (paths.length > 0) {
        workflowStore.completeStage(WorkflowStage.PROGRAM);
    } else {
        // If no paths exist, invalidate stages after WorkflowStage.PREPARE
        workflowStore.invalidateDownstreamStages(WorkflowStage.PREPARE);
    }
}

function createPathsStore() {
    const initialState: PathsState = {
        paths: [],
        selectedPathId: null,
        highlightedPathId: null,
    };

    const { subscribe, set, update } = writable<PathsState>(initialState);

    return {
        subscribe,

        addPath: (path: Omit<Path, 'id'>) => {
            update((state) => {
                const newPaths: Path[] = [
                    ...state.paths,
                    {
                        ...path,
                        id: crypto.randomUUID(),
                    },
                ];

                // Check workflow completion
                setTimeout(() => checkProgramStageCompletion(newPaths), 0);

                return {
                    ...state,
                    paths: newPaths,
                };
            });
        },

        updatePath: (id: string, updates: Partial<Path>) => {
            update((state) => ({
                ...state,
                paths: state.paths.map((path) =>
                    path.id === id ? { ...path, ...updates } : path
                ),
            }));
        },

        deletePath: (id: string) => {
            update((state) => {
                const newPaths: Path[] = state.paths.filter(
                    (path) => path.id !== id
                );

                // Check workflow completion
                setTimeout(() => checkProgramStageCompletion(newPaths), 0);

                return {
                    ...state,
                    paths: newPaths,
                    selectedPathId:
                        state.selectedPathId === id
                            ? null
                            : state.selectedPathId,
                    highlightedPathId:
                        state.highlightedPathId === id
                            ? null
                            : state.highlightedPathId,
                };
            });
        },

        deletePathsByOperation: (operationId: string) => {
            update((state) => {
                const newPaths: Path[] = state.paths.filter(
                    (path) => path.operationId !== operationId
                );

                // Check workflow completion
                setTimeout(() => checkProgramStageCompletion(newPaths), 0);

                return {
                    ...state,
                    paths: newPaths,
                    selectedPathId: state.paths.some(
                        (p) =>
                            p.operationId === operationId &&
                            p.id === state.selectedPathId
                    )
                        ? null
                        : state.selectedPathId,
                    highlightedPathId: state.paths.some(
                        (p) =>
                            p.operationId === operationId &&
                            p.id === state.highlightedPathId
                    )
                        ? null
                        : state.highlightedPathId,
                };
            });
        },

        selectPath: (pathId: string | null) => {
            update((state) => ({
                ...state,
                selectedPathId: pathId,
            }));
        },

        highlightPath: (pathId: string | null) => {
            update((state) => ({
                ...state,
                highlightedPathId: pathId,
            }));
        },

        clearHighlight: () => {
            update((state) => ({
                ...state,
                highlightedPathId: null,
            }));
        },

        reorderPaths: (newPaths: Path[]) => {
            update((state) => ({
                ...state,
                paths: newPaths,
            }));
        },

        getPathsByChain: (chainId: string) => {
            let currentPaths: Path[] = [];
            const unsubscribe: () => void = subscribe((state) => {
                currentPaths = state.paths.filter(
                    (path) => path.chainId === chainId
                );
            });
            unsubscribe();
            return currentPaths;
        },

        getChainsWithPaths: () => {
            let chainIds: string[] = [];
            const unsubscribe: () => void = subscribe((state) => {
                chainIds = [
                    ...new Set(state.paths.map((path) => path.chainId)),
                ];
            });
            unsubscribe();
            return chainIds;
        },

        // Update lead geometry for a path
        updatePathLeadGeometry: (
            pathId: string,
            leadGeometry: {
                leadIn?: { points: Point2D[]; type: LeadType };
                leadOut?: { points: Point2D[]; type: LeadType };
                validation?: {
                    isValid: boolean;
                    warnings: string[];
                    errors: string[];
                    severity: 'info' | 'warning' | 'error';
                };
            }
        ) => {
            const timestamp: string = new Date().toISOString();
            const version: string = '1.0.0'; // Lead calculation algorithm version

            update((state) => ({
                ...state,
                paths: state.paths.map((path) => {
                    if (path.id !== pathId) return path;

                    const updates: Partial<Path> = {};

                    if (leadGeometry.leadIn) {
                        updates.calculatedLeadIn = {
                            points: leadGeometry.leadIn.points,
                            type: leadGeometry.leadIn.type,
                            generatedAt: timestamp,
                            version,
                        };
                    }

                    if (leadGeometry.leadOut) {
                        updates.calculatedLeadOut = {
                            points: leadGeometry.leadOut.points,
                            type: leadGeometry.leadOut.type,
                            generatedAt: timestamp,
                            version,
                        };
                    }

                    if (leadGeometry.validation) {
                        updates.leadValidation = {
                            ...leadGeometry.validation,
                            validatedAt: timestamp,
                        };
                    }

                    return { ...path, ...updates };
                }),
            }));
        },

        // Clear calculated lead geometry (force recalculation)
        clearPathLeadGeometry: (pathId: string) => {
            update((state) => ({
                ...state,
                paths: state.paths.map((path) =>
                    path.id === pathId
                        ? {
                              ...path,
                              calculatedLeadIn: undefined,
                              calculatedLeadOut: undefined,
                              leadValidation: undefined,
                          }
                        : path
                ),
            }));
        },

        // Update offset geometry for a path
        updatePathOffsetGeometry: (
            pathId: string,
            offsetGeometry: {
                offsetShapes: Shape[];
                originalShapes: Shape[];
                direction: OffsetDirection;
                kerfWidth: number;
            }
        ) => {
            const timestamp: string = new Date().toISOString();
            const version: string = '1.0.0'; // Offset calculation algorithm version

            update((state) => ({
                ...state,
                paths: state.paths.map((path) => {
                    if (path.id !== pathId) return path;

                    return {
                        ...path,
                        calculatedOffset: {
                            offsetShapes: offsetGeometry.offsetShapes,
                            originalShapes: offsetGeometry.originalShapes,
                            direction: offsetGeometry.direction,
                            kerfWidth: offsetGeometry.kerfWidth,
                            generatedAt: timestamp,
                            version,
                        },
                    };
                }),
            }));
        },

        // Clear calculated offset geometry (force recalculation)
        clearPathOffsetGeometry: (pathId: string) => {
            update((state) => ({
                ...state,
                paths: state.paths.map((path) =>
                    path.id === pathId
                        ? {
                              ...path,
                              calculatedOffset: undefined,
                          }
                        : path
                ),
            }));
        },

        reset: () => {
            set(initialState);
            // Check workflow completion (will invalidate since no paths)
            setTimeout(() => checkProgramStageCompletion([]), 0);
        },

        // Restore state from persistence (preserves IDs and calculated data)
        restore: (pathsState: PathsState) => {
            set(pathsState);
            // Check workflow completion
            setTimeout(() => checkProgramStageCompletion(pathsState.paths), 0);
        },
    };
}

export const pathStore: ReturnType<typeof createPathsStore> =
    createPathsStore();

// Helper functions for path selection
export function selectPath(pathId: string | null) {
    pathStore.selectPath(pathId);
}

export function highlightPath(pathId: string | null) {
    pathStore.highlightPath(pathId);
}

export function clearPathHighlight() {
    pathStore.clearHighlight();
}
