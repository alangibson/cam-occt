/**
 * Operations Store Interfaces
 *
 * Type definitions for operations and related data structures.
 */

import { CutDirection, LeadType } from '$lib/types/direction';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { GapFillingResult } from '$lib/algorithms/offset-calculation/chain/types';
import type { Point2D, Shape } from '$lib/types';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import type { Path } from '$lib/stores/paths/interfaces';

export interface OffsetCalculation {
    offsetShapes: Shape[];
    originalShapes: Shape[];
    direction: OffsetDirection;
    kerfWidth: number;
    generatedAt: string;
    version: string;
    gapFills?: GapFillingResult[];
}

export interface ChainOffsetResult {
    offsetShapes: Shape[];
    originalShapes: Shape[];
    kerfWidth: number;
    gapFills?: GapFillingResult[];
    warnings?: string[];
}

export interface Operation {
    id: string;
    name: string;
    toolId: string | null; // Reference to tool from tool store
    targetType: 'parts' | 'chains';
    targetIds: string[]; // IDs of parts or chains this operation applies to
    enabled: boolean;
    order: number; // Execution order
    cutDirection: CutDirection; // Preferred cut direction
    leadInType: LeadType; // Lead-in type
    leadInLength: number; // Lead-in length (units)
    leadInFlipSide: boolean; // Flip which side of the chain the lead-in is on
    leadInAngle: number; // Manual rotation angle for lead-in (degrees, 0-360)
    leadInFit: boolean; // Whether to automatically adjust lead-in length to avoid solid areas
    leadOutType: LeadType; // Lead-out type
    leadOutLength: number; // Lead-out length (units)
    leadOutFlipSide: boolean; // Flip which side of the chain the lead-out is on
    leadOutAngle: number; // Manual rotation angle for lead-out (degrees, 0-360)
    leadOutFit: boolean; // Whether to automatically adjust lead-out length to avoid solid areas
    kerfCompensation?: KerfCompensation; // Kerf compensation type (none, inner, outer, part)
    holeUnderspeedEnabled?: boolean; // Enable velocity reduction for holes
    holeUnderspeedPercent?: number; // Velocity percentage for holes (10-100)
}

export interface OperationsStore {
    subscribe: (run: (value: Operation[]) => void) => () => void;
    addOperation: (operation: Omit<Operation, 'id'>) => void;
    updateOperation: (id: string, updates: Partial<Operation>) => void;
    deleteOperation: (id: string) => void;
    reorderOperations: (newOrder: Operation[]) => void;
    duplicateOperation: (id: string) => void;
    applyOperation: (operationId: string) => void;
    applyAllOperations: () => void;
    reset: () => void;
    getAssignedTargets: (excludeOperationId?: string) => {
        chains: Set<string>;
        parts: Set<string>;
    };
}
export interface PathGenerationResult {
    paths: Omit<Path, 'id'>[];
    warnings: {
        chainId: string;
        operationId: string;
        offsetWarnings: string[];
        clearExistingWarnings: boolean;
    }[];
} /**
 * Calculated lead geometry data structure
 */

export interface PathLeadResult {
    leadIn?: {
        points: Point2D[];
        type: LeadType;
    };
    leadOut?: {
        points: Point2D[];
        type: LeadType;
    };
    validation?: {
        isValid: boolean;
        warnings: string[];
        errors: string[];
        severity: 'info' | 'warning' | 'error';
    };
}
