import type { Warning } from '../warnings/interfaces';

export interface LeadWarning extends Warning {
    type: 'lead-in' | 'lead-out';
}
