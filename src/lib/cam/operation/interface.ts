import type { KerfCompensation } from '$lib/cam/operation/enums';
import type { CutDirection, OptimizeStarts } from '$lib/cam/cut/enums';
import type { LeadConfig } from '$lib/cam/lead/interfaces';

export interface Operation {
    id: string;
    name: string;
    toolId: string | null; // Reference to tool from tool store
    targetType: 'parts' | 'chains';
    targetIds: string[]; // IDs of parts or chains this operation applies to
    enabled: boolean;
    order: number; // Execution order
    cutDirection: CutDirection; // Preferred cut direction
    leadInConfig: LeadConfig; // Lead-in configuration
    leadOutConfig: LeadConfig; // Lead-out configuration
    kerfCompensation?: KerfCompensation; // Kerf compensation type (none, inner, outer, part)
    holeUnderspeedEnabled?: boolean; // Enable velocity reduction for holes
    holeUnderspeedPercent?: number; // Velocity percentage for holes (10-100)
    optimizeStarts?: OptimizeStarts; // Optimize start points (none, midpoint)
}
