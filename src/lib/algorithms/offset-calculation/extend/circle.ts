import type { Circle, Point2D, Arc } from '../../../types/geometry';
import type { OperationParams } from '../shared/fill-extend-ops';
import { MAX_EXTENSION } from '../../../constants';
import { 
  processCircleOperation,
  validateCircleIntersectionPoint,
  calculateCircleAngle,
  determineCircleExtension,
  createArcFromCircle,
  getCirclePoint
} from '../shared/fill-extend-ops';

/**
 * Circle Extension Module
 * 
 * This module provides circle extension functionality by converting circles to
 * arcs with expanded angular coverage. Since circles are closed shapes, extension
 * creates an arc that reaches the target intersection point.
 */

/**
 * Extension direction options for circles
 */
export type CircleExtensionDirection = 'start' | 'end' | 'auto';

/**
 * Extension options for circle operations
 */
export interface CircleExtensionOptions {
  /** Maximum distance to extend */
  maxExtension?: number;
  /** Geometric tolerance */
  tolerance?: number;
  /** Which end to extend */
  direction?: CircleExtensionDirection;
}

/**
 * Result of circle extension calculation
 */
export interface CircleExtensionResult {
  /** Whether the extension calculation succeeded */
  success: boolean;
  /** Angular extension in radians */
  angularExtension: number;
  /** Direction of extension */
  direction: 'start' | 'end';
  /** Original start angle for the arc */
  originalStartAngle: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Extend a circle to reach a specific intersection point
 * 
 * @param circle - The circle geometry to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Extension options
 * @returns Extended arc or null if extension failed
 */
export function extendCircleToPoint(
  circle: Circle,
  intersectionPoint: Point2D,
  options: CircleExtensionOptions = {}
): Arc | null {
  const defaultOptions: CircleExtensionOptions = {
    maxExtension: MAX_EXTENSION,
    tolerance: 1e-6,
    direction: 'auto' as CircleExtensionDirection
  };
  const opts = { ...defaultOptions, ...options };
  
  // Convert to OperationParams for shared library
  const params: OperationParams = {
    tolerance: opts.tolerance!,
    maxExtension: opts.maxExtension!,
    extendDirection: opts.direction
  };

  try {
    // Use shared processing logic
    const result = processCircleOperation(circle, intersectionPoint, 'extend', params);
    
    if (!result.success) {
      return null;
    }
    
    return result.resultGeometry as Arc;

  } catch {
    return null;
  }
}

/**
 * Check if a point is on the circle within tolerance
 */
export function isPointOnCircle(
  point: Point2D, 
  circle: Circle, 
  tolerance: number
): { onCircle: boolean; distance: number } {
  
  const validation = validateCircleIntersectionPoint(point, circle, tolerance);
  
  return {
    onCircle: validation.isValid,
    distance: validation.distance || 0
  };
}

// Re-export shared functions for backward compatibility
export { 
  calculateCircleAngle, 
  determineCircleExtension, 
  createArcFromCircle, 
  getCirclePoint 
};