import type { LeadType } from './enums';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { LeadGeometryType } from './types';

export interface LeadConfig {
    type: LeadType;
    length: number; // For arc: length along the arc
    flipSide?: boolean; // Flip which side of the chain the lead is on
    angle?: number; // Manual rotation angle (degrees, 0-360). If undefined, auto-calculated
    fit?: boolean; // Whether to automatically adjust length to avoid solid areas
}

export interface Lead {
    geometry: LeadGeometryType;
    type: LeadType;
    normal?: Point2D; // Unit vector pointing in the normal direction (perpendicular to lead tangent)
    connectionPoint?: Point2D; // Where the lead connects to the chain/shape
    kerfOverlapsChain?: boolean; // Whether the lead kerf overlaps with the cut's underlying chain
}

export interface LeadResult {
    leadIn?: Lead;
    leadOut?: Lead;
    warnings?: string[];
}

export interface CacheableLead extends Lead {
    generatedAt: string; // ISO timestamp
    version: string; // Algorithm version for invalidation
}
