import { CutDirection } from '$lib/cam/cut/enums';
import { KerfCompensation, OperationAction } from '$lib/cam/operation/enums';

export const DEFAULT_OPERATION_ACTION = OperationAction.CUT;

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

export const DEFAULT_SPOT_DURATION = 500; // milliseconds
