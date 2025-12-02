/**
 * Unified Selection Store
 *
 * Centralized selection management for all entity types in the application.
 * Automatically handles cross-type selection exclusivity.
 */

import { writable } from 'svelte/store';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import type { SelectionState, SelectionStore } from './interfaces';

const initialState: SelectionState = {
    shapes: {
        selected: new Set(),
        hovered: null,
        selectedOffset: null,
    },
    chains: {
        selected: new Set(),
        highlighted: null,
    },
    parts: {
        selected: new Set(),
        highlighted: null,
        hovered: null,
    },
    cuts: {
        selected: new Set(),
        highlighted: null,
    },
    rapids: {
        selected: new Set(),
        highlighted: null,
    },
    leads: {
        selected: new Set(),
        highlighted: null,
    },
    kerfs: {
        selected: null,
        highlighted: null,
    },
};

function createSelectionStore(): SelectionStore {
    const { subscribe, update, set } = writable<SelectionState>(initialState);

    return {
        subscribe,

        // Shape selection
        selectShape: (shapeIdOrShape: string | ShapeData, multi = false) =>
            update((state) => {
                // Extract ID and full shape object
                const shapeId =
                    typeof shapeIdOrShape === 'string'
                        ? shapeIdOrShape
                        : shapeIdOrShape.id;

                const selected = new Set(multi ? state.shapes.selected : []);
                selected.add(shapeId);

                return {
                    ...state,
                    shapes: {
                        ...state.shapes,
                        selected,
                        selectedOffset: null, // Clear offset selection when selecting regular shapes
                    },
                };
            }),

        deselectShape: (shapeId: string) =>
            update((state) => {
                const selected = new Set(state.shapes.selected);
                selected.delete(shapeId);
                return {
                    ...state,
                    shapes: {
                        ...state.shapes,
                        selected,
                    },
                };
            }),

        clearShapeSelection: () =>
            update((state) => ({
                ...state,
                shapes: {
                    ...state.shapes,
                    selected: new Set(),
                },
            })),

        setHoveredShape: (shapeId: string | null) =>
            update((state) => ({
                ...state,
                shapes: {
                    ...state.shapes,
                    hovered: shapeId,
                },
            })),

        selectOffsetShape: (shape: ShapeData | null) =>
            update((state) => ({
                ...state,
                shapes: {
                    ...state.shapes,
                    selectedOffset: shape,
                    selected: new Set(), // Clear regular shape selection when selecting offset shape
                },
            })),

        clearOffsetShapeSelection: () =>
            update((state) => ({
                ...state,
                shapes: {
                    ...state.shapes,
                    selectedOffset: null,
                },
            })),

        // Chain selection
        selectChain: (chainId: string | null, multi = false) =>
            update((state) => {
                if (chainId === null) {
                    return {
                        ...state,
                        chains: {
                            ...state.chains,
                            selected: new Set(),
                        },
                    };
                }

                const selected = new Set(multi ? state.chains.selected : []);
                selected.add(chainId);
                return {
                    ...state,
                    chains: {
                        ...state.chains,
                        selected,
                    },
                };
            }),

        deselectChain: (chainId: string) =>
            update((state) => {
                const selected = new Set(state.chains.selected);
                selected.delete(chainId);
                return {
                    ...state,
                    chains: {
                        ...state.chains,
                        selected,
                    },
                };
            }),

        toggleChainSelection: (chainId: string) =>
            update((state) => {
                const selected = new Set(state.chains.selected);
                if (selected.has(chainId)) {
                    selected.delete(chainId);
                } else {
                    selected.add(chainId);
                }
                return {
                    ...state,
                    chains: {
                        ...state.chains,
                        selected,
                    },
                };
            }),

        clearChainSelection: () =>
            update((state) => ({
                ...state,
                chains: {
                    ...state.chains,
                    selected: new Set(),
                },
            })),

        highlightChain: (chainId: string | null) =>
            update((state) => ({
                ...state,
                chains: {
                    ...state.chains,
                    highlighted: chainId,
                },
            })),

        clearChainHighlight: () =>
            update((state) => ({
                ...state,
                chains: {
                    ...state.chains,
                    highlighted: null,
                },
            })),

        // Part selection
        selectPart: (partId: string | null, multi = false) =>
            update((state) => {
                if (partId === null) {
                    return {
                        ...state,
                        parts: {
                            ...state.parts,
                            selected: new Set(),
                        },
                    };
                }

                const selected = new Set(multi ? state.parts.selected : []);
                selected.add(partId);
                return {
                    ...state,
                    parts: {
                        ...state.parts,
                        selected,
                    },
                };
            }),

        deselectPart: (partId: string) =>
            update((state) => {
                const selected = new Set(state.parts.selected);
                selected.delete(partId);
                return {
                    ...state,
                    parts: {
                        ...state.parts,
                        selected,
                    },
                };
            }),

        togglePartSelection: (partId: string) =>
            update((state) => {
                const selected = new Set(state.parts.selected);
                if (selected.has(partId)) {
                    selected.delete(partId);
                } else {
                    selected.add(partId);
                }
                return {
                    ...state,
                    parts: {
                        ...state.parts,
                        selected,
                    },
                };
            }),

        clearPartSelection: () =>
            update((state) => ({
                ...state,
                parts: {
                    ...state.parts,
                    selected: new Set(),
                },
            })),

        highlightPart: (partId: string) =>
            update((state) => ({
                ...state,
                parts: {
                    ...state.parts,
                    highlighted: partId,
                },
            })),

        clearPartHighlight: () =>
            update((state) => ({
                ...state,
                parts: {
                    ...state.parts,
                    highlighted: null,
                },
            })),

        hoverPart: (partId: string | null) =>
            update((state) => ({
                ...state,
                parts: {
                    ...state.parts,
                    hovered: partId,
                },
            })),

        clearPartHover: () =>
            update((state) => ({
                ...state,
                parts: {
                    ...state.parts,
                    hovered: null,
                },
            })),

        // Cut selection
        selectCut: (cutId: string | null, multi = false) =>
            update((state) => {
                if (cutId === null) {
                    return {
                        ...state,
                        cuts: {
                            ...state.cuts,
                            selected: new Set(),
                        },
                    };
                }

                const selected = new Set(multi ? state.cuts.selected : []);
                selected.add(cutId);
                return {
                    ...state,
                    cuts: {
                        ...state.cuts,
                        selected,
                    },
                };
            }),

        deselectCut: (cutId: string) =>
            update((state) => {
                const selected = new Set(state.cuts.selected);
                selected.delete(cutId);
                return {
                    ...state,
                    cuts: {
                        ...state.cuts,
                        selected,
                    },
                };
            }),

        toggleCutSelection: (cutId: string) =>
            update((state) => {
                const selected = new Set(state.cuts.selected);
                if (selected.has(cutId)) {
                    selected.delete(cutId);
                } else {
                    selected.add(cutId);
                }
                return {
                    ...state,
                    cuts: {
                        ...state.cuts,
                        selected,
                    },
                };
            }),

        clearCutSelection: () =>
            update((state) => ({
                ...state,
                cuts: {
                    ...state.cuts,
                    selected: new Set(),
                },
            })),

        highlightCut: (cutId: string | null) =>
            update((state) => ({
                ...state,
                cuts: {
                    ...state.cuts,
                    highlighted: cutId,
                },
            })),

        clearCutHighlight: () =>
            update((state) => ({
                ...state,
                cuts: {
                    ...state.cuts,
                    highlighted: null,
                },
            })),

        // Rapid selection
        selectRapids: (rapidIds: Set<string>) =>
            update((state) => ({
                ...state,
                rapids: {
                    ...state.rapids,
                    selected: new Set(rapidIds),
                },
            })),

        toggleRapidSelection: (rapidId: string) =>
            update((state) => {
                const selected = new Set(state.rapids.selected);
                if (selected.has(rapidId)) {
                    selected.delete(rapidId);
                } else {
                    selected.add(rapidId);
                }
                return {
                    ...state,
                    rapids: {
                        ...state.rapids,
                        selected,
                    },
                };
            }),

        clearRapidSelection: () =>
            update((state) => ({
                ...state,
                rapids: {
                    ...state.rapids,
                    selected: new Set(),
                },
            })),

        highlightRapid: (rapidId: string | null) =>
            update((state) => ({
                ...state,
                rapids: {
                    ...state.rapids,
                    highlighted: rapidId,
                },
            })),

        clearRapidHighlight: () =>
            update((state) => ({
                ...state,
                rapids: {
                    ...state.rapids,
                    highlighted: null,
                },
            })),

        // Lead selection
        selectLead: (leadId: string | null, multi = false) =>
            update((state) => {
                if (leadId === null) {
                    return {
                        ...state,
                        leads: {
                            ...state.leads,
                            selected: new Set(),
                        },
                    };
                }

                const selected = new Set(multi ? state.leads.selected : []);
                selected.add(leadId);
                return {
                    ...state,
                    leads: {
                        ...state.leads,
                        selected,
                    },
                };
            }),

        toggleLeadSelection: (leadId: string) =>
            update((state) => {
                const selected = new Set(state.leads.selected);
                if (selected.has(leadId)) {
                    selected.delete(leadId);
                } else {
                    selected.add(leadId);
                }
                return {
                    ...state,
                    leads: {
                        ...state.leads,
                        selected,
                    },
                };
            }),

        clearLeadSelection: () =>
            update((state) => ({
                ...state,
                leads: {
                    ...state.leads,
                    selected: new Set(),
                },
            })),

        highlightLead: (leadId: string | null) =>
            update((state) => ({
                ...state,
                leads: {
                    ...state.leads,
                    highlighted: leadId,
                },
            })),

        clearLeadHighlight: () =>
            update((state) => ({
                ...state,
                leads: {
                    ...state.leads,
                    highlighted: null,
                },
            })),

        // Kerf selection
        selectKerf: (kerfId: string | null) =>
            update((state) => ({
                ...state,
                kerfs: {
                    ...state.kerfs,
                    selected: kerfId,
                },
            })),

        highlightKerf: (kerfId: string | null) =>
            update((state) => ({
                ...state,
                kerfs: {
                    ...state.kerfs,
                    highlighted: kerfId,
                },
            })),

        clearKerfSelection: () =>
            update((state) => ({
                ...state,
                kerfs: {
                    ...state.kerfs,
                    selected: null,
                },
            })),

        clearKerfHighlight: () =>
            update((state) => ({
                ...state,
                kerfs: {
                    ...state.kerfs,
                    highlighted: null,
                },
            })),

        // Global operations
        clearAllSelections: () =>
            update((state) => ({
                ...state,
                shapes: {
                    ...state.shapes,
                    selected: new Set(),
                    selectedOffset: null,
                },
                chains: { ...state.chains, selected: new Set() },
                parts: { ...state.parts, selected: new Set() },
                cuts: { ...state.cuts, selected: new Set() },
                rapids: { ...state.rapids, selected: new Set() },
                leads: { ...state.leads, selected: new Set() },
                kerfs: { ...state.kerfs, selected: null },
            })),

        clearAllHighlights: () =>
            update((state) => ({
                ...state,
                shapes: { ...state.shapes, hovered: null },
                chains: { ...state.chains, highlighted: null },
                parts: { ...state.parts, highlighted: null, hovered: null },
                cuts: { ...state.cuts, highlighted: null },
                rapids: { ...state.rapids, highlighted: null },
                leads: { ...state.leads, highlighted: null },
                kerfs: { ...state.kerfs, highlighted: null },
            })),

        reset: () => set(initialState),
    };
}

export const selectionStore: ReturnType<typeof createSelectionStore> =
    createSelectionStore();
