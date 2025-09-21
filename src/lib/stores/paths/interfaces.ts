/**
 * Path Store Interfaces
 *
 * Type definitions for paths and path-related data.
 */

import type { Shape } from '$lib/types';
import { CutDirection } from '$lib/types/direction';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { GapFillingResult } from '$lib/algorithms/offset-calculation/chain/types';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { PathLeadResult } from '$lib/stores/operations/interfaces';
import type {
    CacheableLead,
    LeadConfig,
    LeadValidationResult,
} from '$lib/algorithms/leads/interfaces';

export interface Path {
    id: string;
    name: string;
    enabled: boolean;
    order: number; // Execution order within operation

    operationId: string; // Reference to the operation that created this path
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

    // Hole
    //
    // Whether this path is a hole (for velocity reduction)
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

export interface PathsState {
    paths: Path[];
    selectedPathId: string | null;
    highlightedPathId: string | null;
}

export interface PathsStore {
    subscribe: (run: (value: PathsState) => void) => () => void;
    addPath: (path: Path) => void;
    updatePath: (id: string, updates: Partial<Path>) => void;
    deletePath: (id: string) => void;
    deletePathsByOperation: (operationId: string) => void;
    selectPath: (pathId: string | null) => void;
    highlightPath: (pathId: string | null) => void;
    clearHighlight: () => void;
    reorderPaths: (newPaths: Path[]) => void;
    getPathsByChain: (chainId: string) => Path[];
    getChainsWithPaths: () => string[];
    updatePathLeadGeometry: (
        pathId: string,
        leadGeometry: PathLeadResult
    ) => void;
    clearPathLeadGeometry: (pathId: string) => void;
    updatePathOffsetGeometry: (
        pathId: string,
        offsetGeometry: {
            offsetShapes: Shape[];
            originalShapes: Shape[];
            direction: OffsetDirection;
            kerfWidth: number;
        }
    ) => void;
    clearPathOffsetGeometry: (pathId: string) => void;
    reset: () => void;
    restore: (pathsState: PathsState) => void;
}
