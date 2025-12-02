import { writable, derived } from 'svelte/store';

// Visualization flags
export const showLeadNormals = writable(false);
export const showLeadPaths = writable(true);
export const showLeadKerfs = writable(false);

// Exported store with visualization state only
export const leadStore = derived(
    [showLeadNormals, showLeadPaths, showLeadKerfs],
    ([$showLeadNormals, $showLeadPaths, $showLeadKerfs]) => ({
        showLeadNormals: $showLeadNormals,
        showLeadPaths: $showLeadPaths,
        showLeadKerfs: $showLeadKerfs,
    })
);

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
