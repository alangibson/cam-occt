/**
 * Cut Store Interfaces
 *
 * Type definitions for cuts and cut-related data.
 */

import type { Shape, Point2D } from '$lib/types';
import { CutDirection } from '$lib/types/direction';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { NormalSide } from '$lib/types/cam';
import type { GapFillingResult } from '$lib/algorithms/offset-calculation/chain/types';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { CutLeadResult } from '$lib/stores/operations/interfaces';
import type {
    CacheableLead,
    LeadConfig,
    LeadValidationResult,
} from '$lib/algorithms/leads/interfaces';

export interface Cut {
    id: string;
    name: string;
    enabled: boolean;
    order: number; // Execution order within operation

    operationId: string; // Reference to the operation that created this cut
    chainId: string; // Reference to the source chain
    toolId: string | null; // Reference to the tool used

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
    // Lead validation results (persisted)
    leadValidation?: LeadValidationResult;

    // Offsets
    //
    // Kerf compensation width
    kerfWidth?: number;
    // Kerf compensation fields
    kerfCompensation?: OffsetDirection; // Direction of kerf compensation
    // Calculated offset geometry (persisted to avoid recalculation)
    offset?: {
        offsetShapes: Shape[]; // The offset chain shapes
        originalShapes: Shape[]; // The original unmodified chain shapes
        direction: OffsetDirection; // The direction that was applied
        kerfWidth: number; // The kerf width used for calculation
        generatedAt: string; // ISO timestamp
        version: string; // Algorithm version for invalidation
        gapFills?: GapFillingResult[];
    };
}

export interface CutsState {
    cuts: Cut[];
    selectedCutId: string | null;
    highlightedCutId: string | null;
    showCutNormals: boolean;
    showCutter: boolean;
    showCutDirections: boolean;
    showCutPaths: boolean;
}

export interface CutsStore {
    subscribe: (run: (value: CutsState) => void) => () => void;
    addCut: (cut: Cut) => void;
    updateCut: (id: string, updates: Partial<Cut>) => void;
    deleteCut: (id: string) => void;
    deleteCutsByOperation: (operationId: string) => void;
    selectCut: (cutId: string | null) => void;
    highlightCut: (cutId: string | null) => void;
    clearHighlight: () => void;
    reorderCuts: (newCuts: Cut[]) => void;
    getCutsByChain: (chainId: string) => Cut[];
    getChainsWithCuts: () => string[];
    updateCutLeadGeometry: (cutId: string, leadGeometry: CutLeadResult) => void;
    clearCutLeadGeometry: (cutId: string) => void;
    updateCutOffsetGeometry: (
        cutId: string,
        offsetGeometry: {
            offsetShapes: Shape[];
            originalShapes: Shape[];
            direction: OffsetDirection;
            kerfWidth: number;
        }
    ) => void;
    clearCutOffsetGeometry: (cutId: string) => void;
    setShowCutNormals: (show: boolean) => void;
    setShowCutter: (show: boolean) => void;
    setShowCutDirections: (show: boolean) => void;
    setShowCutPaths: (show: boolean) => void;
    reset: () => void;
    restore: (cutsState: CutsState) => void;
}
