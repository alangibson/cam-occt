import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import type { LeadConfig } from '$lib/algorithms/leads/interfaces';

export const DEFAULT_LEAD_IN_CONFIG: LeadConfig = {
    type: LeadType.ARC,
    length: 5,
    angle: 0,
    flipSide: false,
    fit: false,
};

export const DEFAULT_LEAD_OUT_CONFIG: LeadConfig = {
    type: LeadType.ARC,
    length: 5,
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
