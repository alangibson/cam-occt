/**
 * Path Store Interfaces
 *
 * Type definitions for paths and path-related data.
 */

import type { Point2D, Shape } from '$lib/types';
import { CutDirection, LeadType } from '$lib/types/direction';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { GapFillingResult } from '$lib/algorithms/offset-calculation/chain/types';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { PathLeadResult } from '$lib/stores/operations/interfaces';

export interface Path {
    id: string;
    name: string;
    operationId: string; // Reference to the operation that created this path
    chainId: string; // Reference to the source chain
    toolId: string | null; // Reference to the tool used
    enabled: boolean;
    order: number; // Execution order within operation
    cutDirection: CutDirection; // User-defined cut direction from operation
    feedRate?: number; // Cutting speed
    pierceHeight?: number; // Height for pierce operation
    pierceDelay?: number; // Delay for pierce operation
    arcVoltage?: number; // Arc voltage for plasma cutting
    kerfWidth?: number; // Kerf compensation width
    thcEnabled?: boolean; // Torch height control
    leadInLength?: number; // Lead-in length
    leadInType?: LeadType; // Lead-in type
    leadInFlipSide?: boolean; // Flip which side of the chain the lead-in is on
    leadInAngle?: number; // Manual rotation angle for lead-in (degrees, 0-360)
    leadInFit?: boolean; // Whether to automatically adjust lead-in length to avoid solid areas
    leadOutLength?: number; // Lead-out length
    leadOutType?: LeadType; // Lead-out type
    leadOutFlipSide?: boolean; // Flip which side of the chain the lead-out is on
    leadOutAngle?: number; // Manual rotation angle for lead-out (degrees, 0-360)
    leadOutFit?: boolean; // Whether to automatically adjust lead-out length to avoid solid areas
    overcutLength?: number; // Overcut length
    isHole?: boolean; // Whether this path is a hole (for velocity reduction)
    holeUnderspeedPercent?: number; // Velocity percentage for hole cutting (10-100)

    // Execution direction (independent of underlying chain's natural winding)
    executionClockwise?: boolean | null; // true=clockwise execution, false=counterclockwise, null=no direction (open chains)

    // Cut chain - cloned chain with shapes reordered for user-specified cut direction
    cutChain?: Chain; // Cloned chain with shapes ordered for execution direction

    // Calculated lead geometry (persisted to avoid recalculation)
    calculatedLeadIn?: {
        points: Point2D[];
        type: LeadType;
        generatedAt: string; // ISO timestamp
        version: string; // Algorithm version for invalidation
    };
    calculatedLeadOut?: {
        points: Point2D[];
        type: LeadType;
        generatedAt: string; // ISO timestamp
        version: string; // Algorithm version for invalidation
    };

    // Lead validation results (persisted)
    leadValidation?: {
        isValid: boolean;
        warnings: string[];
        errors: string[];
        severity: 'info' | 'warning' | 'error';
        validatedAt: string; // ISO timestamp
    };

    // Kerf compensation fields
    kerfCompensation?: OffsetDirection; // Direction of kerf compensation

    // Calculated offset geometry (persisted to avoid recalculation)
    calculatedOffset?: {
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
    addPath: (path: Omit<Path, 'id'>) => void;
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
