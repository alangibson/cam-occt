import type {
    KerfCompensation,
    OperationAction,
} from '$lib/cam/operation/enums';
import type { CutDirection, OptimizeStarts } from '$lib/cam/cut/enums';
import type { LeadConfig } from '$lib/cam/lead/interfaces';

/**
 * OperationData - Serializable operation data structure
 *
 * This interface represents the JSON-serializable form of an operation.
 * It stores only IDs (toolId, targetIds) for relationships.
 *
 * The Operation class wraps this data and provides setters/getters for
 * resolved objects (Tool, Chain[], Part[]) for use during cut generation.
 */
export interface OperationData {
    id: string;
    name: string;
    action: OperationAction; // Operation action type (cut, spot)
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
    spotDuration?: number; // Duration in milliseconds for spot operations
}
