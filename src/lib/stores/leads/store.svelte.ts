import type { LeadState } from './interfaces';

class LeadStore {
    showLeadNormals = $state(false);
    showLeadPaths = $state(true);
    showLeadKerfs = $state(false);

    setShowLeadNormals(show: boolean) {
        this.showLeadNormals = show;
    }

    setShowLeadPaths(show: boolean) {
        this.showLeadPaths = show;
    }

    setShowLeadKerfs(show: boolean) {
        this.showLeadKerfs = show;
    }

    reset() {
        this.showLeadNormals = false;
        this.showLeadPaths = true;
        this.showLeadKerfs = false;
    }

    // Restore state from persistence (preserves IDs and calculated data)
    restore(leadState: LeadState) {
        this.showLeadNormals = leadState.showLeadNormals;
        this.showLeadPaths = leadState.showLeadPaths;
        this.showLeadKerfs = leadState.showLeadKerfs;
    }
}

export const leadStore: LeadStore = new LeadStore();

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
