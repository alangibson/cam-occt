import { LeadType } from './enums';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import { tessellateArc } from '$lib/geometry/arc/functions';
import type { Lead, LeadConfig } from './interfaces';
import type { CutData } from '$lib/cam/cut/interfaces';
import { normalizeVector } from '$lib/geometry/math/functions';
import { getDefaults } from '$lib/config/defaults/defaults-manager';

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
        return tessellateArc(arc, getDefaults().geometry.tessellationTolerance);
    }
    return [];
}

/**
 * Create lead-in configuration from cut
 */
export function createLeadInConfig(cut: CutData): LeadConfig {
    if (cut.leadInConfig) {
        return {
            type: cut.leadInConfig.type,
            length: cut.leadInConfig.length,
            flipSide: cut.leadInConfig.flipSide ?? false,
            angle: cut.leadInConfig.angle,
            fit: cut.leadInConfig.fit ?? true,
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
 * Create lead-out configuration from cut
 */
export function createLeadOutConfig(cut: CutData): LeadConfig {
    if (cut.leadOutConfig) {
        return {
            type: cut.leadOutConfig.type,
            length: cut.leadOutConfig.length,
            flipSide: cut.leadOutConfig.flipSide ?? false,
            angle: cut.leadOutConfig.angle,
            fit: cut.leadOutConfig.fit ?? true,
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
 * Create both lead configurations from cut
 */
export function createLeadConfigs(cut: CutData): {
    leadIn: LeadConfig;
    leadOut: LeadConfig;
} {
    return {
        leadIn: createLeadInConfig(cut),
        leadOut: createLeadOutConfig(cut),
    };
}

/**
 * Extract normal and connection point from an arc lead
 * For lead-in: connection point is at the arc end, normal points outward from arc center at start
 * For lead-out: connection point is at the arc start, normal points outward from arc center at start
 */
export function extractLeadNormalAndConnection(
    lead: Lead,
    isLeadIn: boolean
): { normal: Point2D; connectionPoint: Point2D } | undefined {
    if (lead.type !== LeadType.ARC || !lead.geometry) {
        return undefined;
    }

    const arc = lead.geometry as Arc;

    // Get arc endpoints
    const DEGREES_IN_HALF_CIRCLE = 180;
    const DEG_TO_RAD = Math.PI / DEGREES_IN_HALF_CIRCLE;
    const startAngleRad = arc.startAngle * DEG_TO_RAD;
    const endAngleRad = arc.endAngle * DEG_TO_RAD;

    const arcStart: Point2D = {
        x: arc.center.x + arc.radius * Math.cos(startAngleRad),
        y: arc.center.y + arc.radius * Math.sin(startAngleRad),
    };

    const arcEnd: Point2D = {
        x: arc.center.x + arc.radius * Math.cos(endAngleRad),
        y: arc.center.y + arc.radius * Math.sin(endAngleRad),
    };

    let connectionPoint: Point2D;
    let normalAngleRad: number;

    if (isLeadIn) {
        // For lead-in: arc ends at the connection point
        connectionPoint = arcEnd;
        // Normal at the start of the arc (outward from center)
        normalAngleRad = startAngleRad;
    } else {
        // For lead-out: arc starts at the connection point
        connectionPoint = arcStart;
        // Normal at the start of the arc (outward from center)
        normalAngleRad = startAngleRad;
    }

    // Calculate normal vector (pointing outward from arc center)
    const normal = normalizeVector({
        x: Math.cos(normalAngleRad),
        y: Math.sin(normalAngleRad),
    });

    return {
        normal,
        connectionPoint,
    };
}
