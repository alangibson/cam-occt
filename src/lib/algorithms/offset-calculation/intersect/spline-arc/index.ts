import type { Shape, Arc, Spline } from '../../../../types/geometry';
import type { IntersectionResult } from '../../chain/types';
import {
    createVerbCurveFromArc,
    createVerbCurveFromSpline,
    processVerbIntersectionResults,
} from '../../../../utils/verb-integration-utils';
import { INTERSECTION_TOLERANCE } from '../../../../constants';
import { DEFAULT_EXTENSION_LENGTH } from '../../../../geometry/constants';
import { createExtendedSplineVerb } from '../../extend/spline';
import { createExtendedArc } from '../../extend/arc';
import { processSplineWithCurveIntersection } from '../../shared/spline-intersection-utils';
import verb from 'verb-nurbs';

/**
 * Find intersections between a spline and an arc using verb-nurbs
 * Implements INTERSECTION.md recommendation #130: "Convert arc to NURBs and use NURBs-NURBs routine"
 * Supports bidirectional extension for gap intersection detection
 */
export function findSplineArcIntersectionsVerb(
    splineShape: Shape,
    arcShape: Shape,
    swapParams: boolean = false,
    allowExtensions: boolean = false,
    extensionLength: number = DEFAULT_EXTENSION_LENGTH
): IntersectionResult[] {
    const spline: import('$lib/types/geometry').Spline =
        splineShape.geometry as Spline;
    const arc: import('$lib/types/geometry').Arc = arcShape.geometry as Arc;

    // First try intersection with original shapes
    const originalResults: IntersectionResult[] =
        findSplineArcIntersectionsCore(spline, arc, swapParams);

    if (originalResults.length > 0 || !allowExtensions) {
        return originalResults;
    }

    // No intersections with original shapes and extensions allowed
    // Try all combinations of extended shapes
    const allExtensionResults: IntersectionResult[] = [];

    // Try 1: Extended spline vs original arc
    try {
        const extendedSplineCurve = createExtendedSplineVerb(
            spline,
            true,
            true,
            extensionLength
        );
        const originalArcCurve = createVerbCurveFromArc(arc);
        const intersections = verb.geom.Intersect.curves(
            extendedSplineCurve,
            originalArcCurve,
            INTERSECTION_TOLERANCE
        );
        const results = processVerbIntersectionResults(
            intersections,
            swapParams,
            true
        );
        allExtensionResults.push(...results);
    } catch {
        // Spline extension failed, skip
    }

    // Try 2: Original spline vs extended arc
    try {
        const originalSplineCurve = createVerbCurveFromSpline(spline);
        const extendedArc = createExtendedArc(arc, extensionLength);
        const extendedArcCurve = createVerbCurveFromArc(extendedArc);
        const intersections = verb.geom.Intersect.curves(
            originalSplineCurve,
            extendedArcCurve,
            INTERSECTION_TOLERANCE
        );
        const results = processVerbIntersectionResults(
            intersections,
            swapParams,
            true
        );
        allExtensionResults.push(...results);
    } catch {
        // Arc extension failed, skip
    }

    // Try 3: Extended spline vs extended arc (for maximum gap coverage)
    try {
        const extendedSplineCurve = createExtendedSplineVerb(
            spline,
            true,
            true,
            extensionLength
        );
        const extendedArc = createExtendedArc(arc, extensionLength);
        const extendedArcCurve = createVerbCurveFromArc(extendedArc);
        const intersections = verb.geom.Intersect.curves(
            extendedSplineCurve,
            extendedArcCurve,
            INTERSECTION_TOLERANCE
        );
        const results = processVerbIntersectionResults(
            intersections,
            swapParams,
            true
        );
        allExtensionResults.push(...results);
    } catch {
        // Extension failed, skip
    }

    return allExtensionResults;
}

/**
 * Core intersection calculation between a spline and an arc
 */
function findSplineArcIntersectionsCore(
    spline: Spline,
    arc: Arc,
    swapParams: boolean = false
): IntersectionResult[] {
    // Use shared utility for basic spline-curve intersection
    const arcCurve = createVerbCurveFromArc(arc);
    return processSplineWithCurveIntersection(
        spline,
        arcCurve,
        swapParams,
        false
    );
}
