/**
 * Ellipse Utilities Library
 * 
 * Consolidates duplicated ellipse calculation functions from:
 * - src/lib/utils/tessellation.ts
 * - src/lib/utils/geometric-operations.ts  
 * - src/lib/geometry/ellipse.ts
 * - Various offset-calculation modules
 */

import type { Point2D, Ellipse } from '../types/geometry';

/**
 * Calculate a point on an ellipse at a given parameter value
 * Consolidates calculateEllipsePoint from tessellation.ts
 */
export function calculateEllipsePoint(
  ellipse: Ellipse,
  param: number,
  majorAxisLength: number,
  minorAxisLength: number,
  majorAxisAngle: number
): Point2D {
  const x: number = majorAxisLength * Math.cos(param);
  const y: number = minorAxisLength * Math.sin(param);
  
  const rotatedX: number = x * Math.cos(majorAxisAngle) - y * Math.sin(majorAxisAngle);
  const rotatedY: number = x * Math.sin(majorAxisAngle) + y * Math.cos(majorAxisAngle);
  
  return {
    x: ellipse.center.x + rotatedX,
    y: ellipse.center.y + rotatedY
  };
}

/**
 * Calculate an ellipse point with rotation - convenience function
 * Consolidates similar logic from geometric-operations.ts
 */
export function calculateEllipsePointWithRotation(
  center: Point2D, 
  majorAxis: number, 
  minorAxis: number, 
  angle: number, 
  param: number
): Point2D {
  const x: number = majorAxis * Math.cos(param);
  const y: number = minorAxis * Math.sin(param);
  
  const rotatedX: number = x * Math.cos(angle) - y * Math.sin(angle);
  const rotatedY: number = x * Math.sin(angle) + y * Math.cos(angle);
  
  return {
    x: center.x + rotatedX,
    y: center.y + rotatedY
  };
}

/**
 * Generate multiple points along an ellipse
 * Consolidates generateEllipsePoints from geometric-operations.ts
 */
export function generateEllipsePoints(
  ellipse: Ellipse,
  startParam: number,
  endParam: number,
  numPoints: number
): Point2D[] {
  const points: Point2D[] = [];
  const majorAxisLength: number = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
  const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
  
  for (let i = 0; i < numPoints; i++) {
    const param = startParam + (endParam - startParam) * i / (numPoints - 1);
    points.push(calculateEllipsePoint(ellipse, param, majorAxisLength, minorAxisLength, majorAxisAngle));
  }
  
  return points;
}

/**
 * Tessellate ellipse with specified number of points
 * Provides a simpler interface to ellipse tessellation
 */
export function tessellateEllipse(ellipse: Ellipse, numPoints: number): Point2D[] {
  const majorAxisLength = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
  const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
  
  const isArc = typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number';
  
  if (isArc && ellipse.startParam !== undefined && ellipse.endParam !== undefined) {
    // Ellipse arc - use parameter range
    let deltaParam = ellipse.endParam - ellipse.startParam;
    if (deltaParam < 0) {
      deltaParam += 2 * Math.PI;
    }
    
    const points: Point2D[] = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const param = ellipse.startParam + t * deltaParam;
      points.push(calculateEllipsePoint(ellipse, param, majorAxisLength, minorAxisLength, majorAxisAngle));
    }
    return points;
  } else {
    // Full ellipse
    return generateEllipsePoints(ellipse, 0, 2 * Math.PI, numPoints);
  }
}

/**
 * Get start and end points of an ellipse
 * Consolidates logic from ellipse.ts
 */
export function getEllipseStartEndPoints(ellipse: Ellipse): { start: Point2D; end: Point2D } {
  const majorAxisLength = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
  const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
  
  if (typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number') {
    // For ellipse arcs, use parameter values
    const start = calculateEllipsePoint(ellipse, ellipse.startParam, majorAxisLength, minorAxisLength, majorAxisAngle);
    const end = calculateEllipsePoint(ellipse, ellipse.endParam, majorAxisLength, minorAxisLength, majorAxisAngle);
    return { start, end };
  } else {
    // For full ellipses, start and end are the same (rightmost point)
    const point = {
      x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
      y: ellipse.center.y + ellipse.majorAxisEndpoint.y
    };
    return { start: point, end: point };
  }
}

/**
 * Calculate ellipse axis lengths and angle
 * Helper function used by many ellipse operations
 */
export function getEllipseParameters(ellipse: Ellipse): {
  majorAxisLength: number;
  minorAxisLength: number;
  majorAxisAngle: number;
} {
  const majorAxisLength = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
  const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
  
  return { majorAxisLength, minorAxisLength, majorAxisAngle };
}

/**
 * Determine if an ellipse represents a full ellipse (closed) or an arc
 * A full ellipse has either no start/end parameters or spans approximately 2π
 */
export function isFullEllipse(ellipse: Ellipse): boolean {
  // If no start/end parameters, it's a full ellipse
  if (typeof ellipse.startParam !== 'number' || typeof ellipse.endParam !== 'number') {
    return true;
  }
  
  // Calculate parameter span
  let paramSpan = ellipse.endParam - ellipse.startParam;
  if (paramSpan < 0) {
    paramSpan += 2 * Math.PI;
  }
  
  // Consider it a full ellipse if span is approximately 2π (within small tolerance)
  const fullCircle = 2 * Math.PI;
  const tolerance = 1e-10;
  return Math.abs(paramSpan - fullCircle) < tolerance;
}

/**
 * Determine if an ellipse is closed (represents a full ellipse) or open (ellipse arc)
 * 
 * This function consolidates the ellipse closed detection logic used across the application:
 * - If no start/end parameters exist, assume it's a full closed ellipse
 * - If start parameter is near 0 and end parameter is near 2π, it's a full closed ellipse  
 * - Otherwise, it's an open ellipse arc
 * 
 * @param ellipse - The ellipse geometry to check
 * @param tolerance - Numeric tolerance for comparing parameter values (default: 0.001)
 * @returns true if ellipse is closed (full ellipse), false if open (ellipse arc)
 */
export function isEllipseClosed(ellipse: Ellipse, tolerance: number = 0.001): boolean {
  // If no start/end parameters, assume it's a full closed ellipse
  if (typeof ellipse.startParam !== 'number' || typeof ellipse.endParam !== 'number') {
    return true;
  }
  
  // Check if it's a full ellipse (start ≈ 0, end ≈ 2π)
  const startParam = ellipse.startParam;
  const endParam = ellipse.endParam;
  const fullCircle = 2 * Math.PI;
  
  // Consider it a full ellipse if start is near 0 and end is near 2π
  const isFullEllipse = Math.abs(startParam) < tolerance && Math.abs(endParam - fullCircle) < tolerance;
  
  return isFullEllipse;
}

/**
 * Calculate distance from a point to an ellipse perimeter
 * Returns the minimum distance from the point to the ellipse outline
 */
export function distanceFromEllipsePerimeter(point: Point2D, ellipse: Ellipse): number {
  const { majorAxisLength, minorAxisLength, majorAxisAngle } = getEllipseParameters(ellipse);
  
  // Transform point to ellipse coordinate system (centered at origin, aligned with axes)
  const dx = point.x - ellipse.center.x;
  const dy = point.y - ellipse.center.y;
  const rotatedX = dx * Math.cos(-majorAxisAngle) - dy * Math.sin(-majorAxisAngle);
  const rotatedY = dx * Math.sin(-majorAxisAngle) + dy * Math.cos(-majorAxisAngle);
  
  // Normalize coordinates by axis lengths
  const normalizedX = rotatedX / majorAxisLength;
  const normalizedY = rotatedY / minorAxisLength;
  
  // Calculate distance from unit ellipse (where both axes = 1)
  const distanceFromUnit = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
  
  // Convert back to actual distance
  // For points on the ellipse perimeter, distanceFromUnit = 1
  // Distance from perimeter = |distanceFromUnit - 1| * minimum axis length
  return Math.abs(distanceFromUnit - 1) * Math.min(majorAxisLength, minorAxisLength);
}