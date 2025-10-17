import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import {
    OptimizeStarts,
    DEFAULT_OPTIMIZE_STARTS,
} from '$lib/types/optimize-starts';
import type { LeadConfig } from '$lib/cam/lead/interfaces';
import { getDefaults } from '$lib/config';

/**
 * Get default lead-in configuration based on current measurement system
 */
export function getDefaultLeadInConfig(): LeadConfig {
    const defaults = getDefaults();
    return {
        type: LeadType.ARC,
        length: defaults.lead.leadInLength, // Unit-aware default
        angle: 0,
        flipSide: false,
        fit: false,
    };
}

/**
 * Get default lead-out configuration based on current measurement system
 */
export function getDefaultLeadOutConfig(): LeadConfig {
    const defaults = getDefaults();
    return {
        type: LeadType.ARC,
        length: defaults.lead.leadOutLength, // Unit-aware default
        angle: 0,
        flipSide: false,
        fit: false,
    };
}

// For backward compatibility - these will use the current measurement system
export const DEFAULT_LEAD_IN_CONFIG: LeadConfig = {
    type: LeadType.ARC,
    length: 5, // TODO: Replace usages with getDefaultLeadInConfig()
    angle: 0,
    flipSide: false,
    fit: false,
};

export const DEFAULT_LEAD_OUT_CONFIG: LeadConfig = {
    type: LeadType.ARC,
    length: 5, // TODO: Replace usages with getDefaultLeadOutConfig()
    angle: 0,
    flipSide: false,
    fit: false,
};

export const DEFAULT_CUT_DIRECTION = CutDirection.COUNTERCLOCKWISE;

export const DEFAULT_KERF_COMPENSATION = {
    forParts: KerfCompensation.PART,
    forChains: KerfCompensation.NONE,
};

export const DEFAULT_HOLE_UNDERSPEED = {
    enabled: false,
    percent: 60,
};

export const DEFAULT_OPERATION_ENABLED = true;

export { DEFAULT_OPTIMIZE_STARTS, OptimizeStarts };
