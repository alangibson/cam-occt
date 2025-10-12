import { writable, derived } from 'svelte/store';

// Visualization flags
export const showLeadNormals = writable(false);
export const showLeadPaths = writable(true);

// Selection state
const selectedLeadIdStore = writable<string | null>(null);
const highlightedLeadIdStore = writable<string | null>(null);

// Exported store with selection state
export const leadStore = derived(
    [
        selectedLeadIdStore,
        highlightedLeadIdStore,
        showLeadNormals,
        showLeadPaths,
    ],
    ([
        $selectedLeadId,
        $highlightedLeadId,
        $showLeadNormals,
        $showLeadPaths,
    ]) => ({
        selectedLeadId: $selectedLeadId,
        highlightedLeadId: $highlightedLeadId,
        showLeadNormals: $showLeadNormals,
        showLeadPaths: $showLeadPaths,
    })
);

/**
 * Select a lead by its ID (format: {cutId}-leadIn or {cutId}-leadOut)
 */
export function selectLead(leadId: string | null): void {
    selectedLeadIdStore.set(leadId);
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
    selectedLeadIdStore.set(null);
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
