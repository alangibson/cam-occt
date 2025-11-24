import type { Point2D } from '$lib/geometry/point/interfaces';
import { CutDirection } from './enums';
import type { CacheableLead, LeadConfig } from '$lib/cam/lead/interfaces';
import type { NormalSide } from './enums';
import type { OffsetDirection } from '$lib/cam/offset/types';
import type { Rapid } from '$lib/cam/rapid/interfaces';
import type { OffsetData } from '$lib/cam/offset/interfaces';
import type { Chain } from '$lib/cam/chain/classes';
import type { OperationAction } from '$lib/cam/operation/enums';

export interface CutData {
    id: string;
    name: string;
    enabled: boolean;
    order: number; // Execution order within operation

    operationId: string; // Reference to the operation that created this cut
    chainId: string; // Reference to the source chain
    toolId: string | null; // Reference to the tool used
    action: OperationAction; // Operation action type (cut, spot)

    feedRate?: number; // Cutting speed
    pierceHeight?: number; // Height for pierce operation
    pierceDelay?: number; // Delay for pierce operation
    arcVoltage?: number; // Arc voltage for plasma cutting
    thcEnabled?: boolean; // Torch height control
    overcutLength?: number; // Overcut length

    // Cut
    //
    // User-defined cut direction from operation
    cutDirection: CutDirection;
    // Cloned chain with shapes reordered for user-specified cut direction
    cutChain?: Chain;
    // Execution direction (independent of underlying chain's natural winding)
    // true=clockwise execution, false=counterclockwise, null=no direction (open chains)
    executionClockwise?: boolean | null;

    // Cut Normal
    //
    // Normal direction for this cut (perpendicular to cut path, accounting for part context and cut direction)
    // This is the source of truth used by both visualization and lead calculation
    normal: Point2D; // Normalized normal vector
    normalConnectionPoint: Point2D; // Point where normal is calculated (cut start point)
    normalSide: NormalSide; // Which side the normal is on (for machine cutter compensation)

    // Hole
    //
    // Whether this cut is a hole (for velocity reduction)
    isHole?: boolean;
    // Velocity percentage for hole cutting (10-100)
    holeUnderspeedPercent?: number;

    // Spot
    //
    // Duration in milliseconds for spot operations
    spotDuration?: number;

    // Rapids
    //
    // Rapid movement into this cut (from previous cut or origin)
    rapidIn?: Rapid;

    // Leads
    //
    // Lead-in configuration
    leadInConfig?: LeadConfig;
    // Lead-out configuration
    leadOutConfig?: LeadConfig;
    // Calculated lead geometry (persisted to avoid recalculation)
    leadIn?: CacheableLead;
    // Calculated lead geometry (persisted to avoid recalculation)
    leadOut?: CacheableLead;

    // Offsets
    //
    // Kerf compensation width
    kerfWidth?: number;
    // Kerf compensation fields
    kerfCompensation?: OffsetDirection; // Direction of kerf compensation
    // Calculated offset geometry (persisted to avoid recalculation)
    offset?: OffsetData;
}
