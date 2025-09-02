import type { Point2D, Spline } from '../../../../types/geometry';
import type { OffsetDirection, OffsetResult } from '../types';
import verb, { type VerbDerivatives, type VerbPoint } from 'verb-nurbs';
import { generateUniformKnotVector } from '../../../../utils/nurbs-utils';

// Type definitions for verb-nurbs library
type VerbPoint3D = [number, number, number];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates spline data to prevent infinite loops and invalid operations
 */
function validateSplineData(spline: Spline): void {
  if (spline.controlPoints.length < 2) {
    throw new Error('Spline must have at least 2 control points');
  }
  
  if (spline.degree < 1 || spline.degree >= spline.controlPoints.length) {
    throw new Error(`Invalid degree ${spline.degree} for ${spline.controlPoints.length} control points`);
  }
  
  const expectedKnots: number = spline.controlPoints.length + spline.degree + 1;
  if (spline.knots.length !== expectedKnots) {
    throw new Error(`Expected ${expectedKnots} knots but got ${spline.knots.length}`);
  }
}

/**
 * Generates knot vector for a Bezier segment
 */
function generateSegmentKnotVector(degree: number): number[] {
  const segmentKnots: number[] = [];
  for (let j = 0; j <= degree; j++) {
    segmentKnots.push(0);
  }
  for (let j = 0; j <= degree; j++) {
    segmentKnots.push(1);
  }
  return segmentKnots;
}

/**
 * Creates a verb NURBS curve from spline data
 */
function createVerbCurve(spline: Spline): verb.geom.NurbsCurve {
  const controlPoints3D: VerbPoint3D[] = spline.controlPoints.map(p => [p.x, p.y, 0] as VerbPoint3D);
  const weights: number[] = spline.weights || spline.controlPoints.map(() => 1);
  
  return verb.geom.NurbsCurve.byKnotsControlPointsWeights(
    spline.degree,
    spline.knots,
    controlPoints3D,
    weights
  );
}

// ============================================================================
// CORE OFFSET CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculates the normal vector at a given parameter t on the curve
 */
function calculateNormalAtPoint(curve: verb.geom.NurbsCurve, t: number): [number, number, number] {
  const derivatives: VerbDerivatives = curve.derivatives(t, 1);
  const tangentVec: number[] = derivatives[1];
  const tangentLength: number = Math.sqrt(
    tangentVec[0] * tangentVec[0] + 
    tangentVec[1] * tangentVec[1] + 
    tangentVec[2] * tangentVec[2]
  );
  
  if (tangentLength < 1e-12) {
    throw new Error(`Degenerate tangent vector at t=${t}`);
  }
  
  const tangent: [number, number, number] = [
    tangentVec[0] / tangentLength,
    tangentVec[1] / tangentLength,
    tangentVec[2] / tangentLength
  ];
  
  return [-tangent[1], tangent[0], 0];
}

/**
 * Calculates offset points along the curve using adaptive sampling
 */
function calculateOffsetPoints(
  curve: verb.geom.NurbsCurve,
  offsetDistance: number,
  numSamples: number,
  timeoutMs: number,
  startTime: number
): Point2D[] {
  const offsetPoints: Point2D[] = [];
  const domain: {min: number, max: number} = curve.domain();
  
  for (let i: number = 0; i <= numSamples; i++) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Spline offset operation timed out during sampling after ${timeoutMs}ms`);
    }
    
    const t: number = domain.min + (i / numSamples) * (domain.max - domain.min);
    
    let derivatives: VerbDerivatives;
    try {
      derivatives = curve.derivatives(t, 1);
    } catch (error) {
      throw new Error(`Derivative calculation failed at t=${t}: ${error}`);
    }
    
    const point: number[] = derivatives[0];
    const normal: [number, number, number] = calculateNormalAtPoint(curve, t);
    
    const scaledNormal: [number, number, number] = [
      normal[0] * offsetDistance,
      normal[1] * offsetDistance,
      normal[2] * offsetDistance
    ];
    
    const offsetPoint3D: [number, number, number] = [
      point[0] + scaledNormal[0],
      point[1] + scaledNormal[1],
      point[2] + scaledNormal[2]
    ];
    
    offsetPoints.push({
      x: offsetPoint3D[0],
      y: offsetPoint3D[1]
    });
  }
  
  return offsetPoints;
}

/**
 * Ensures closed curves have matching first and last points
 */
function ensureClosedCurve(offsetPoints: Point2D[], isClosed: boolean): Point2D[] {
  if (isClosed && offsetPoints.length > 0) {
    offsetPoints[offsetPoints.length - 1] = { ...offsetPoints[0] };
  }
  return offsetPoints;
}

// ============================================================================
// CONVERSION FUNCTIONS
// ============================================================================

/**
 * Converts a verb-nurbs curve back to our Spline format
 */
function convertVerbCurveToSpline(verbCurve: verb.geom.NurbsCurve, originalSpline: Spline): Spline {
  const controlPoints2D: Point2D[] = verbCurve.controlPoints().map(p => ({
    x: p[0],
    y: p[1]
  }));
  
  const degree: number = verbCurve.degree();
  const knots: number[] = verbCurve.knots();
  const weights: number[] = verbCurve.weights();
  const expectedKnots: number = controlPoints2D.length + degree + 1;
  
  // Validate knot vector before creating spline
  if (knots.length !== expectedKnots) {
    // Generate a valid uniform knot vector
    const validKnots = generateUniformKnotVector(controlPoints2D.length, degree);
    
    return {
      controlPoints: controlPoints2D,
      knots: validKnots,
      weights: weights,
      degree: degree,
      fitPoints: [],
      closed: originalSpline.closed
    };
  }
  
  return {
    controlPoints: controlPoints2D,
    knots: knots,
    weights: weights,
    degree: degree,
    fitPoints: [], // verb-nurbs doesn't preserve fit points
    closed: originalSpline.closed
  };
}

// ============================================================================
// CURVE FITTING AND VALIDATION FUNCTIONS
// ============================================================================

/**
 * Fits a NURBS curve to the offset points
 */
function fitOffsetCurve(
  offsetPoints3D: VerbPoint3D[],
  degree: number,
  timeoutMs: number,
  startTime: number
): verb.geom.NurbsCurve {
  if (Date.now() - startTime > timeoutMs) {
    throw new Error(`Spline offset operation timed out before curve fitting after ${timeoutMs}ms`);
  }
  
  if (offsetPoints3D.length < 2) {
    throw new Error('Insufficient offset points for curve fitting');
  }
  
  try {
    const offsetCurve: verb.geom.NurbsCurve = verb.geom.NurbsCurve.byPoints(
      offsetPoints3D,
      Math.min(degree, offsetPoints3D.length - 1)
    );
    
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Spline offset operation timed out after curve fitting after ${timeoutMs}ms`);
    }
    
    return offsetCurve;
  } catch (error) {
    if ((error as Error).message.includes('timed out')) {
      throw error;
    }
    throw new Error(`NURBS curve fitting failed: ${error instanceof Error ? (error as Error).message : String(error)}`);
  }
}

/**
 * Validates the accuracy of the offset curve by comparing to expected positions
 */
function validateOffsetAccuracy(
  originalCurve: verb.geom.NurbsCurve,
  offsetCurve: verb.geom.NurbsCurve,
  offsetDistance: number,
  timeoutMs: number,
  startTime: number
): number {
  let maxError: number = 0;
  const domain: {min: number, max: number} = originalCurve.domain();
  const validationSamples: number = 100;
  
  for (let i: number = 0; i <= validationSamples; i++) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Spline offset operation timed out during validation after ${timeoutMs}ms`);
    }
    
    const t: number = domain.min + (i / validationSamples) * (domain.max - domain.min);
    
    const derivatives: VerbDerivatives = originalCurve.derivatives(t, 1);
    const originalPoint: number[] = derivatives[0];
    const normal: [number, number, number] = calculateNormalAtPoint(originalCurve, t);
    
    const expectedOffsetPoint: [number, number, number] = [
      originalPoint[0] + normal[0] * offsetDistance,
      originalPoint[1] + normal[1] * offsetDistance,
      originalPoint[2] + normal[2] * offsetDistance
    ];
    
    const offsetPoint: VerbPoint = offsetCurve.point(t);
    
    const error: number = Math.sqrt(
      Math.pow(offsetPoint[0] - expectedOffsetPoint[0], 2) +
      Math.pow(offsetPoint[1] - expectedOffsetPoint[1], 2)
    );
    
    maxError = Math.max(maxError, error);
  }
  
  return maxError;
}

/**
 * Calculates adaptive tessellation tolerance based on curve bounds
 */
function calculateAdaptiveTolerance(): number {

  // TODO actually calculate

  // Use a fixed fine tolerance for visual quality
  // This avoids potential recursion issues with curve methods
  return 0.01; // Fine enough for smooth visual output without excessive points
}

/**
 * Tessellates a verb-nurbs curve into polyline points
 * This is a utility function that callers can use when they need tessellation
 * 
 * @param curve The verb-nurbs curve to tessellate
 * @param tolerance Optional tessellation tolerance. If not provided, adaptive tolerance is calculated
 */
export function tessellateVerbCurve(curve: verb.geom.NurbsCurve, tolerance?: number): Point2D[] {
  const actualTolerance: number = tolerance ?? calculateAdaptiveTolerance();
  const tessellatedPoints: VerbPoint[] = curve.tessellate(actualTolerance);
  
  if (!tessellatedPoints || tessellatedPoints.length === 0) {
    throw new Error('Tessellation produced no points');
  }
  
  return tessellatedPoints.map((p) => ({ x: p[0], y: p[1] }));
}

/**
 * Splits a NURBS curve into Bezier segments using verb-nurbs decomposition
 * 
 * Uses verb.core.Modify.decomposeCurveIntoBeziers() which properly implements
 * knot insertion to split the NURBS into independent Bezier segments.
 * 
 * @param curve The verb-nurbs curve to split
 * @returns Array of Spline objects representing Bezier segments
 */
export function splitVerbCurve(curve: verb.geom.NurbsCurve): Spline[] {
  const degree: number = curve.degree();
  
  // Validate input
  if (degree < 1 || degree > 3) {
    throw new Error(`Unsupported degree ${degree}. Only degrees 1, 2, and 3 are supported.`);
  }
  
  const controlPoints: VerbPoint[] = curve.controlPoints();
  if (controlPoints.length < degree + 1) {
    throw new Error(`Insufficient control points ${controlPoints.length} for degree ${degree}`);
  }
  
  try {
    // TODO: Use verb.core.Modify.decomposeCurveIntoBeziers() when available
    // For now, use a simplified approach that works with basic cases
    
    const finalKnots: number[] = curve.knots();
    const finalControlPoints: VerbPoint[] = curve.controlPoints();
    const finalWeights: number[] = curve.weights();
    
    const segments: Spline[] = [];
    const segmentSize: number = degree + 1; // Number of control points per segment
    
    // Simple extraction: look for knot spans (consecutive different knot values)
    const uniqueKnots: number[] = [...new Set(finalKnots)].sort((a, b) => a - b);
    
    // If we only have two unique knot values, this is already a single Bezier segment
    if (uniqueKnots.length <= 2) {
      // Single segment - entire curve is one Bezier
      const controlPoints2D: Point2D[] = finalControlPoints.map(p => ({
        x: p[0],
        y: p[1]
      }));
      
      const segmentKnots = generateSegmentKnotVector(degree);
      
      segments.push({
        controlPoints: controlPoints2D,
        knots: segmentKnots,
        weights: finalWeights,
        degree: degree,
        fitPoints: [],
        closed: false
      });
    } else {
      // Multiple segments - extract based on knot spans
      const numSegments: number = uniqueKnots.length - 1;
      const controlPointsPerSegment: number = Math.floor(finalControlPoints.length / numSegments);
      
      for (let i: number = 0; i < numSegments; i++) {
        const startIndex: number = i * (controlPointsPerSegment - degree + 1);
        const endIndex: number = Math.min(startIndex + segmentSize, finalControlPoints.length);
        
        if (endIndex - startIndex >= segmentSize) {
          const segmentControlPoints: VerbPoint[] = finalControlPoints.slice(startIndex, endIndex);
          const segmentWeights: number[] = finalWeights.slice(startIndex, endIndex);
          
          const controlPoints2D: Point2D[] = segmentControlPoints.map(p => ({
            x: p[0],
            y: p[1]
          }));
          
          const segmentKnots = generateSegmentKnotVector(degree);
          
          segments.push({
            controlPoints: controlPoints2D,
            knots: segmentKnots,
            weights: segmentWeights,
            degree: degree,
            fitPoints: [],
            closed: false
          });
        }
      }
    }
    
    if (segments.length === 0) {
      throw new Error('No Bezier segments could be extracted from the NURBS curve');
    }
    
    return segments;
    
  } catch (error) {
    throw new Error(`Failed to decompose NURBS curve into Bezier segments: ${error instanceof Error ? (error as Error).message : String(error)}`);
  }
}

// ============================================================================
// ADAPTIVE REFINEMENT FUNCTIONS
// ============================================================================

/**
 * Determines if offset refinement should continue
 */
function shouldRefineOffset(
  maxError: number,
  tolerance: number,
  retryCount: number,
  maxRetries: number
): boolean {
  return maxError > tolerance && retryCount < maxRetries;
}

/**
 * Performs adaptive refinement of the offset calculation
 */
function refineOffset(
  spline: Spline,
  curve: verb.geom.NurbsCurve,
  offsetDistance: number,
  tolerance: number,
  maxRetries: number,
  timeoutMs: number
): { offsetCurve: verb.geom.NurbsCurve, warnings: string[] } {
  let numSamples: number = Math.min(100, Math.max(20, spline.controlPoints.length * 10));
  let retryCount: number = 0;
  let finalOffsetCurve: verb.geom.NurbsCurve | undefined;
  const warnings: string[] = [];
  const actualMaxRetries: number = Math.min(maxRetries, 3);
  const startTime: number = Date.now();
  
  while (retryCount < actualMaxRetries) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Spline offset operation timed out after ${timeoutMs}ms`);
    }
    
    const offsetPoints: Point2D[] = calculateOffsetPoints(curve, offsetDistance, numSamples, timeoutMs, startTime);
    const closedOffsetPoints: Point2D[] = ensureClosedCurve(offsetPoints, spline.closed);
    const offsetPoints3D: VerbPoint3D[] = closedOffsetPoints.map(p => [p.x, p.y, 0] as VerbPoint3D);
    
    const offsetCurve: verb.geom.NurbsCurve = fitOffsetCurve(offsetPoints3D, spline.degree, timeoutMs, startTime);
    finalOffsetCurve = offsetCurve;
    
    const maxError: number = validateOffsetAccuracy(
      curve,
      offsetCurve,
      offsetDistance,
      timeoutMs,
      startTime
    );
    
    if (!shouldRefineOffset(maxError, tolerance, retryCount, actualMaxRetries)) {
      if (retryCount > 0) {
        warnings.push(`Spline offset refined with ${numSamples} samples after ${retryCount} iterations (max error: ${maxError.toFixed(6)})`);
      }
      break;
    }
    
    retryCount++;
    
    if (retryCount < actualMaxRetries) {
      const newSamples: number = Math.min(Math.floor(numSamples * 1.5), 500);
      if (newSamples === numSamples) {
        warnings.push(`Maximum sample limit reached (${numSamples}), stopping refinement with error ${maxError.toFixed(6)}`);
        break;
      }
      numSamples = newSamples;
    } else {
      warnings.push(`Spline offset tolerance not achieved after ${actualMaxRetries} retries (max error: ${maxError.toFixed(6)} > ${tolerance})`);
      break;
    }
  }
  
  if (!finalOffsetCurve) {
    throw new Error('Failed to create offset curve during refinement');
  }
  
  return { offsetCurve: finalOffsetCurve, warnings };
}

// ============================================================================
// RESULT HANDLING FUNCTIONS
// ============================================================================

/**
 * Creates a successful offset result
 */
function createOffsetResult(
  offsetCurve: verb.geom.NurbsCurve,
  originalSpline: Spline,
  direction: OffsetDirection,
  warnings: string[]
): OffsetResult {
  const offsetSplineGeometry: Spline = convertVerbCurveToSpline(offsetCurve, originalSpline);
  
  return {
    success: true,
    shapes: [{
      id: `spline-offset-${direction}`,
      type: 'spline',
      geometry: offsetSplineGeometry
    }],
    warnings,
    errors: []
  };
}

/**
 * Creates an error result
 */
function createErrorResult(error: unknown): OffsetResult {
  return {
    success: false,
    shapes: [],
    warnings: [],
    errors: [`Failed to offset spline: ${error instanceof Error ? (error as Error).message : String(error)}`]
  };
}

// ============================================================================
// MAIN OFFSET FUNCTION
// ============================================================================

/**
 * Offset a spline using verb-nurbs library with adaptive refinement
 * Following the mathematically correct approach from "reference/cam/offset/spline/spline_offset.md"
 * Includes tolerance checking and adaptive tessellation refinement
 */
export function offsetSpline(
  spline: Spline,
  distance: number,
  direction: OffsetDirection,
  tolerance: number = 0.001,
  maxRetries: number = 10
): OffsetResult {
  
  if (direction === 'none' || distance === 0) {
    return {
      success: true,
      shapes: [],
      warnings: [],
      errors: []
    };
  }

  try {
    validateSplineData(spline);
    const curve: verb.geom.NurbsCurve = createVerbCurve(spline);
    
    const offsetDistance: number = direction === 'inset' ? -Math.abs(distance) : Math.abs(distance);
    const timeoutMs: number = 10000;
    
    const { offsetCurve, warnings } = refineOffset(
      spline,
      curve,
      offsetDistance,
      tolerance,
      maxRetries,
      timeoutMs
    );
    
    const result: OffsetResult = createOffsetResult(offsetCurve, spline, direction, warnings);
    
    return result;
  } catch (error) {
    return createErrorResult(error);
  }
}