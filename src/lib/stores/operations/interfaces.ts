/**
 * Operations Store Interfaces
 *
 * Type definitions for operations and related data structures.
 */

import { CutDirection } from '$lib/types/direction';
import type { LeadConfig, Lead } from '$lib/algorithms/leads/interfaces';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { GapFillingResult } from '$lib/algorithms/offset-calculation/chain/types';
import type { Shape } from '$lib/types';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import type { Cut } from '$lib/cam/cut/interfaces';
import type { OptimizeStarts } from '$lib/types/optimize-starts';

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
    leadInConfig: LeadConfig; // Lead-in configuration
    leadOutConfig: LeadConfig; // Lead-out configuration
    kerfCompensation?: KerfCompensation; // Kerf compensation type (none, inner, outer, part)
    holeUnderspeedEnabled?: boolean; // Enable velocity reduction for holes
    holeUnderspeedPercent?: number; // Velocity percentage for holes (10-100)
    optimizeStarts?: OptimizeStarts; // Optimize start points (none, midpoint)
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
export interface CutGenerationResult {
    cuts: Cut[];
    warnings: {
        chainId: string;
        operationId: string;
        offsetWarnings: string[];
        clearExistingWarnings: boolean;
    }[];
}

/**
 * Calculated lead geometry data structure
 */

export interface CutLeadResult {
    leadIn?: Lead;
    leadOut?: Lead;
    validation?: {
        isValid: boolean;
        warnings: string[];
        errors: string[];
        severity: 'info' | 'warning' | 'error';
    };
}
