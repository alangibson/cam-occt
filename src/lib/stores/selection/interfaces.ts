/**
 * Selection Store Interfaces
 *
 * Type definitions for the unified selection store.
 */

import type { ShapeData } from '$lib/cam/shape/interfaces';

/**
 * Selection state for a specific entity type
 */
interface EntitySelection<T = string> {
    selected: Set<T>;
    highlighted: T | null;
    hovered?: T | null;
}

/**
 * Selection state for shapes (has additional offset shape selection)
 */
interface ShapeSelection {
    selected: Set<string>;
    hovered: string | null;
    selectedOffset: ShapeData | null;
}

/**
 * Selection state for kerfs (uses single selection instead of Set)
 */
interface KerfSelection {
    selected: string | null;
    highlighted: string | null;
}

/**
 * Complete selection state for all entity types
 */
export interface SelectionState {
    shapes: ShapeSelection;
    chains: EntitySelection;
    parts: EntitySelection & { hovered: string | null };
    cuts: EntitySelection;
    rapids: EntitySelection;
    leads: EntitySelection;
    kerfs: KerfSelection;
}

/**
 * Selection store interface
 */
export interface SelectionStore {
    subscribe: (run: (value: SelectionState) => void) => () => void;

    // Shape selection
    selectShape: (shapeIdOrShape: string | ShapeData, multi?: boolean) => void;
    deselectShape: (shapeId: string) => void;
    clearShapeSelection: () => void;
    setHoveredShape: (shapeId: string | null) => void;
    selectOffsetShape: (shape: ShapeData | null) => void;
    clearOffsetShapeSelection: () => void;

    // Chain selection
    selectChain: (chainId: string | null, multi?: boolean) => void;
    deselectChain: (chainId: string) => void;
    toggleChainSelection: (chainId: string) => void;
    clearChainSelection: () => void;
    highlightChain: (chainId: string | null) => void;
    clearChainHighlight: () => void;

    // Part selection
    selectPart: (partId: string | null, multi?: boolean) => void;
    deselectPart: (partId: string) => void;
    togglePartSelection: (partId: string) => void;
    clearPartSelection: () => void;
    highlightPart: (partId: string) => void;
    clearPartHighlight: () => void;
    hoverPart: (partId: string | null) => void;
    clearPartHover: () => void;

    // Cut selection
    selectCut: (cutId: string | null, multi?: boolean) => void;
    deselectCut: (cutId: string) => void;
    toggleCutSelection: (cutId: string) => void;
    clearCutSelection: () => void;
    highlightCut: (cutId: string | null) => void;
    clearCutHighlight: () => void;

    // Rapid selection
    selectRapids: (rapidIds: Set<string>) => void;
    toggleRapidSelection: (rapidId: string) => void;
    clearRapidSelection: () => void;
    highlightRapid: (rapidId: string | null) => void;
    clearRapidHighlight: () => void;

    // Lead selection
    selectLead: (leadId: string | null, multi?: boolean) => void;
    toggleLeadSelection: (leadId: string) => void;
    clearLeadSelection: () => void;
    highlightLead: (leadId: string | null) => void;
    clearLeadHighlight: () => void;

    // Kerf selection
    selectKerf: (kerfId: string | null) => void;
    highlightKerf: (kerfId: string | null) => void;
    clearKerfSelection: () => void;
    clearKerfHighlight: () => void;

    // Global operations
    clearAllSelections: () => void;
    clearAllHighlights: () => void;
    reset: () => void;
}
