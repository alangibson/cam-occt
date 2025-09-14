import { writable } from 'svelte/store';
import type { Shape } from '$lib/types';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { Path, PathsState, PathsStore } from './interfaces';
import { checkProgramStageCompletion } from './functions';
import type { PathLeadResult } from '$lib/stores/operations/interfaces';

function createPathsStore(): PathsStore {
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
            leadGeometry: PathLeadResult
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
