import { type Warning, createWarningStore } from './warning-store-base';

export interface LeadWarning extends Warning {
    type: 'lead-in' | 'lead-out';
}

export const leadWarningsStore: ReturnType<
    typeof createWarningStore<LeadWarning>
> = createWarningStore<LeadWarning>();
