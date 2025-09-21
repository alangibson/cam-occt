import { LeadType } from '$lib/types/direction';
import type { Point2D, Arc } from '$lib/types/geometry';
import { generateArcPoints } from '$lib/geometry/arc/functions';
import type { Lead, LeadConfig } from './interfaces';
import type { Path } from '$lib/stores/paths/interfaces';

/**
 * Convert LeadGeometry (Arc) to Point2D array for testing
 */
export function convertLeadGeometryToPoints(lead: Lead): Point2D[] {
    if (lead.type === LeadType.ARC) {
        const arc = lead.geometry as Arc;
        // Check for invalid arc geometry (zero radius)
        if (arc.radius <= 0) {
            return [];
        }
        return generateArcPoints(arc);
    }
    return [];
}

/**
 * Create lead-in configuration from path
 */
export function createLeadInConfig(path: Path): LeadConfig {
    if (path.leadInConfig) {
        return {
            type: path.leadInConfig.type,
            length: path.leadInConfig.length,
            flipSide: path.leadInConfig.flipSide ?? false,
            angle: path.leadInConfig.angle,
            fit: path.leadInConfig.fit ?? true,
        };
    }

    // Default configuration when no leadInConfig is present
    return {
        type: LeadType.NONE,
        length: 0,
        flipSide: false,
        angle: undefined,
        fit: true,
    };
}

/**
 * Create lead-out configuration from path
 */
export function createLeadOutConfig(path: Path): LeadConfig {
    if (path.leadOutConfig) {
        return {
            type: path.leadOutConfig.type,
            length: path.leadOutConfig.length,
            flipSide: path.leadOutConfig.flipSide ?? false,
            angle: path.leadOutConfig.angle,
            fit: path.leadOutConfig.fit ?? true,
        };
    }

    // Default configuration when no leadOutConfig is present
    return {
        type: LeadType.NONE,
        length: 0,
        flipSide: false,
        angle: undefined,
        fit: true,
    };
}

/**
 * Create both lead configurations from path
 */
export function createLeadConfigs(path: Path): {
    leadIn: LeadConfig;
    leadOut: LeadConfig;
} {
    return {
        leadIn: createLeadInConfig(path),
        leadOut: createLeadOutConfig(path),
    };
}
