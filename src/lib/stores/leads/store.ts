import { writable, derived } from 'svelte/store';

// Visualization flags
export const showLeadNormals = writable(false);
export const showLeadPaths = writable(true);
export const showLeadKerfs = writable(false);

// Selection state
const selectedLeadIdsStore = writable<Set<string>>(new Set());
const highlightedLeadIdStore = writable<string | null>(null);

// Exported store with selection state
export const leadStore = derived(
    [
        selectedLeadIdsStore,
        highlightedLeadIdStore,
        showLeadNormals,
        showLeadPaths,
        showLeadKerfs,
    ],
    ([
        $selectedLeadIds,
        $highlightedLeadId,
        $showLeadNormals,
        $showLeadPaths,
        $showLeadKerfs,
    ]) => ({
        selectedLeadIds: $selectedLeadIds,
        highlightedLeadId: $highlightedLeadId,
        showLeadNormals: $showLeadNormals,
        showLeadPaths: $showLeadPaths,
        showLeadKerfs: $showLeadKerfs,
    })
);

/**
 * Select a lead by its ID (format: {cutId}-leadIn or {cutId}-leadOut)
 */
export function selectLead(leadId: string | null, multi = false): void {
    if (leadId === null) {
        selectedLeadIdsStore.set(new Set());
        return;
    }

    selectedLeadIdsStore.update((ids) => {
        const newIds = new Set(multi ? ids : []);
        newIds.add(leadId);
        return newIds;
    });
}

/**
 * Deselect a lead by its ID
 */
export function deselectLead(leadId: string): void {
    selectedLeadIdsStore.update((ids) => {
        const newIds = new Set(ids);
        newIds.delete(leadId);
        return newIds;
    });
}

/**
 * Toggle lead selection
 */
export function toggleLeadSelection(leadId: string): void {
    selectedLeadIdsStore.update((ids) => {
        const newIds = new Set(ids);
        if (newIds.has(leadId)) {
            newIds.delete(leadId);
        } else {
            newIds.add(leadId);
        }
        return newIds;
    });
}

/**
 * Highlight a lead by its ID (for hover state)
 */
export function highlightLead(leadId: string | null): void {
    highlightedLeadIdStore.set(leadId);
}

/**
 * Clear lead selection
 */
export function clearLeadSelection(): void {
    selectedLeadIdsStore.set(new Set());
}

/**
 * Clear lead highlight
 */
export function clearLeadHighlight(): void {
    highlightedLeadIdStore.set(null);
}

/**
 * Parse a lead ID into its components
 */
export function parseLeadId(leadId: string): {
    cutId: string;
    leadType: 'leadIn' | 'leadOut';
} | null {
    if (!leadId) return null;

    const parts = leadId.split('-');
    if (parts.length < 2) return null;

    const LAST_INDEX_OFFSET = -1;
    const leadType = parts[parts.length + LAST_INDEX_OFFSET];
    if (leadType !== 'leadIn' && leadType !== 'leadOut') return null;

    const cutId = parts.slice(0, LAST_INDEX_OFFSET).join('-');

    return {
        cutId,
        leadType: leadType as 'leadIn' | 'leadOut',
    };
}
