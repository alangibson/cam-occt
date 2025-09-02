import type { Shape, Circle, Ellipse } from '../../../../types/geometry';
import type { IntersectionResult } from '../../chain/types';
import { createVerbCurveFromEllipse, processVerbIntersectionResults, INTERSECTION_TOLERANCE, createVerbCurveFromCircle } from '../../../../utils/verb-integration-utils';
import verb, { type CurveCurveIntersection } from 'verb-nurbs';

/**
 * Find intersections between an ellipse and a circle using verb-nurbs
 * Implements INTERSECTION.md recommendation #106: "Convert circle to NURBs and use NURBs-NURBs routine"
 */
export function findEllipseCircleIntersectionsVerb(
  ellipseShape: Shape,
  circleShape: Shape,
  swapParams: boolean = false
): IntersectionResult[] {
  const ellipse: import("$lib/types/geometry").Ellipse = ellipseShape.geometry as Ellipse;
  const circle: import("$lib/types/geometry").Circle = circleShape.geometry as Circle;
  
  // Convert both shapes to verb-nurbs curves
  const ellipseCurve: verb.geom.NurbsCurve = createVerbCurveFromEllipse(ellipse);
  const circleCurve: verb.geom.NurbsCurve = createVerbCurveFromCircle(circle);
  
  // Use verb.geom.Intersect.curves() for intersection
  const intersections: CurveCurveIntersection[] = verb.geom.Intersect.curves(ellipseCurve, circleCurve, INTERSECTION_TOLERANCE);
  
  return processVerbIntersectionResults(intersections, swapParams);
}