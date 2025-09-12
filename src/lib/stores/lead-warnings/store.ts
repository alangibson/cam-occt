import { createWarningStore } from '../warnings/store';
import type { LeadWarning } from './interfaces';

export const leadWarningsStore: ReturnType<
    typeof createWarningStore<LeadWarning>
> = createWarningStore<LeadWarning>();
