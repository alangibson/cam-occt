import type { Warning } from '$lib/stores/warnings/interfaces';

export interface LeadWarning extends Warning {
    type: 'lead-in' | 'lead-out';
}
