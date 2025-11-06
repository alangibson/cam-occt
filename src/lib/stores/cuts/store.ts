import { writable } from 'svelte/store';
import type { Shape } from '$lib/geometry/shape/interfaces';
import { OffsetDirection } from '$lib/cam/offset/types';
import type { CutsState, CutsStore } from './interfaces';
import { checkProgramStageCompletion } from './functions';
import type { CutLeadResult } from '$lib/cam/pipeline/leads/interfaces';
import type { Cut } from '$lib/cam/cut/interfaces';
import { kerfStore } from '$lib/stores/kerfs/store';
import type { Operation } from '$lib/cam/operation/interface';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { Part } from '$lib/cam/part/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import { createCutsFromOperation } from '$lib/cam/pipeline/operations/cut-generation';

function createCutsStore(): CutsStore {
    const initialState: CutsState = {
        cuts: [],
        selectedCutIds: new Set(),
        highlightedCutId: null,
        showCutNormals: false,
        showCutDirections: false,
        showCutPaths: true,
        showCutStartPoints: false,
        showCutEndPoints: false,
        showCutTangentLines: false,
    };

    const { subscribe, set, update } = writable<CutsState>(initialState);

    return {
        subscribe,

        addCut: (cut: Cut) => {
            update((state) => {
                // If cut doesn't have an ID, generate one
                const cutToAdd: Cut = cut.id
                    ? cut
                    : { ...cut, id: crypto.randomUUID() };

                const newCuts: Cut[] = [...state.cuts, cutToAdd];

                // Check workflow completion
                setTimeout(() => checkProgramStageCompletion(newCuts), 0);

                return {
                    ...state,
                    cuts: newCuts,
                };
            });
        },

        addCuts: (cuts: Cut[]) => {
            update((state) => {
                // Ensure all cuts have IDs
                const cutsToAdd: Cut[] = cuts.map((cut) =>
                    cut.id ? cut : { ...cut, id: crypto.randomUUID() }
                );

                const newCuts: Cut[] = [...state.cuts, ...cutsToAdd];

                // Check workflow completion once after all cuts added
                setTimeout(() => checkProgramStageCompletion(newCuts), 0);

                return {
                    ...state,
                    cuts: newCuts,
                };
            });
        },

        addCutsByOperation: async (
            operation: Operation,
            chains: Chain[],
            parts: Part[],
            tools: Tool[],
            tolerance: number
        ) => {
            // Remove existing cuts for this operation
            cutStore.deleteCutsByOperation(operation.id);

            // Generate cuts with leads (async, parallelized)
            const result = await createCutsFromOperation(
                operation,
                chains,
                parts,
                tools,
                tolerance
            );

            // Store all generated cuts in a single batch update
            if (result.cuts.length > 0) {
                cutStore.addCuts(result.cuts);
            }
        },

        updateCut: (id: string, updates: Partial<Cut>) => {
            update((state) => ({
                ...state,
                cuts: state.cuts.map((cut) =>
                    cut.id === id ? { ...cut, ...updates } : cut
                ),
            }));
        },

        deleteCut: (id: string) => {
            // Remove all kerfs based on this cut
            kerfStore.deleteKerfsByCut(id);

            update((state) => {
                const newCuts: Cut[] = state.cuts.filter(
                    (cut) => cut.id !== id
                );

                // Check workflow completion
                setTimeout(() => checkProgramStageCompletion(newCuts), 0);

                const selectedCutIds = new Set(state.selectedCutIds);
                selectedCutIds.delete(id);

                return {
                    ...state,
                    cuts: newCuts,
                    selectedCutIds,
                    highlightedCutId:
                        state.highlightedCutId === id
                            ? null
                            : state.highlightedCutId,
                };
            });
        },

        deleteCutsByOperation: (operationId: string) => {
            update((state) => {
                // Get IDs of cuts that will be deleted
                const cutsToDelete = state.cuts.filter(
                    (cut) => cut.operationId === operationId
                );

                // Remove all kerfs based on these cuts
                cutsToDelete.forEach((cut) => {
                    kerfStore.deleteKerfsByCut(cut.id);
                });

                const newCuts: Cut[] = state.cuts.filter(
                    (cut) => cut.operationId !== operationId
                );

                // Check workflow completion
                setTimeout(() => checkProgramStageCompletion(newCuts), 0);

                // Remove deleted cuts from selection
                const selectedCutIds = new Set(state.selectedCutIds);
                cutsToDelete.forEach((cut) => {
                    selectedCutIds.delete(cut.id);
                });

                return {
                    ...state,
                    cuts: newCuts,
                    selectedCutIds,
                    highlightedCutId: state.cuts.some(
                        (c) =>
                            c.operationId === operationId &&
                            c.id === state.highlightedCutId
                    )
                        ? null
                        : state.highlightedCutId,
                };
            });
        },

        selectCut: (cutId: string | null, multi = false) => {
            update((state) => {
                if (cutId === null) {
                    return {
                        ...state,
                        selectedCutIds: new Set(),
                    };
                }

                const selectedCutIds = new Set(
                    multi ? state.selectedCutIds : []
                );
                selectedCutIds.add(cutId);
                return {
                    ...state,
                    selectedCutIds,
                };
            });
        },

        deselectCut: (cutId: string) => {
            update((state) => {
                const selectedCutIds = new Set(state.selectedCutIds);
                selectedCutIds.delete(cutId);
                return {
                    ...state,
                    selectedCutIds,
                };
            });
        },

        toggleCutSelection: (cutId: string) => {
            update((state) => {
                const selectedCutIds = new Set(state.selectedCutIds);
                if (selectedCutIds.has(cutId)) {
                    selectedCutIds.delete(cutId);
                } else {
                    selectedCutIds.add(cutId);
                }
                return {
                    ...state,
                    selectedCutIds,
                };
            });
        },

        highlightCut: (cutId: string | null) => {
            update((state) => ({
                ...state,
                highlightedCutId: cutId,
            }));
        },

        clearHighlight: () => {
            update((state) => ({
                ...state,
                highlightedCutId: null,
            }));
        },

        reorderCuts: (newCuts: Cut[]) => {
            update((state) => ({
                ...state,
                cuts: newCuts,
            }));
        },

        getCutsByChain: (chainId: string) => {
            let currentCuts: Cut[] = [];
            const unsubscribe: () => void = subscribe((state) => {
                currentCuts = state.cuts.filter(
                    (cut) => cut.chainId === chainId
                );
            });
            unsubscribe();
            return currentCuts;
        },

        getChainsWithCuts: () => {
            let chainIds: string[] = [];
            const unsubscribe: () => void = subscribe((state) => {
                chainIds = [...new Set(state.cuts.map((cut) => cut.chainId))];
            });
            unsubscribe();
            return chainIds;
        },

        // Update lead geometry for a cut
        updateCutLeadGeometry: (cutId: string, leadGeometry: CutLeadResult) => {
            const timestamp: string = new Date().toISOString();
            const version: string = '1.0.0'; // Lead calculation algorithm version

            update((state) => ({
                ...state,
                cuts: state.cuts.map((cut) => {
                    if (cut.id !== cutId) return cut;

                    const updates: Partial<Cut> = {};

                    if (leadGeometry.leadIn) {
                        updates.leadIn = {
                            geometry: leadGeometry.leadIn.geometry,
                            type: leadGeometry.leadIn.type,
                            generatedAt: timestamp,
                            version,
                        };
                    }

                    if (leadGeometry.leadOut) {
                        updates.leadOut = {
                            geometry: leadGeometry.leadOut.geometry,
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

                    return { ...cut, ...updates };
                }),
            }));
        },

        // Clear calculated lead geometry (force recalculation)
        clearCutLeadGeometry: (cutId: string) => {
            update((state) => ({
                ...state,
                cuts: state.cuts.map((cut) =>
                    cut.id === cutId
                        ? {
                              ...cut,
                              leadIn: undefined,
                              leadOut: undefined,
                              leadValidation: undefined,
                          }
                        : cut
                ),
            }));
        },

        // Update offset geometry for a cut
        updateCutOffsetGeometry: (
            cutId: string,
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
                cuts: state.cuts.map((cut) => {
                    if (cut.id !== cutId) return cut;

                    return {
                        ...cut,
                        offset: {
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
        clearCutOffsetGeometry: (cutId: string) => {
            update((state) => ({
                ...state,
                cuts: state.cuts.map((cut) =>
                    cut.id === cutId
                        ? {
                              ...cut,
                              offset: undefined,
                          }
                        : cut
                ),
            }));
        },

        setShowCutNormals: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutNormals: show,
            }));
        },

        setShowCutDirections: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutDirections: show,
            }));
        },

        setShowCutPaths: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutPaths: show,
            }));
        },

        setShowCutStartPoints: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutStartPoints: show,
            }));
        },

        setShowCutEndPoints: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutEndPoints: show,
            }));
        },

        setShowCutTangentLines: (show: boolean) => {
            update((state) => ({
                ...state,
                showCutTangentLines: show,
            }));
        },

        reset: () => {
            set(initialState);
            // Check workflow completion (will invalidate since no cuts)
            setTimeout(() => checkProgramStageCompletion([]), 0);
        },

        // Restore state from persistence (preserves IDs and calculated data)
        restore: (cutsState: CutsState) => {
            set(cutsState);
            // Check workflow completion
            setTimeout(() => checkProgramStageCompletion(cutsState.cuts), 0);
        },
    };
}

export const cutStore: ReturnType<typeof createCutsStore> = createCutsStore();
