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
