import type { Shape, Point2D, Spline } from '../../../../../lib/types/geometry';
import type { FillOptions, FillResult, ShapeExtension } from '../types';
import { 
  extendSplineToPoint, 
  determineSplineExtensionDirection,
  calculateSplineExtension,
  getSplinePoint, 
  type SplineExtensionResult
} from '../../extend/spline';

/**
 * Spline Fill Module
 * 
 * This module provides gap filling for spline (NURBS) shapes by extending them
 * to intersection points. Splines can be extended by:
 * 1. Extending the parameter range beyond 0 or 1
 * 2. Adding control points to continue the curve smoothly
 * 3. Linear extension from the end tangent (fallback)
 */

/**
 * Extend a spline to reach a specific intersection point
 * 
 * @param shape - The spline shape to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Fill operation options
 * @returns Result containing the extended spline or error information
 */
export function fillSplineToIntersection(
  shape: Shape,
  intersectionPoint: Point2D,
  options: FillOptions
): FillResult {
  if (shape.type !== 'spline') {
    return createFailureResult('Shape must be a spline');
  }

  const spline: import("$lib/types/geometry").Spline = shape.geometry as Spline; // NURBS spline geometry
  
  try {
    // Use the extend module for all extension logic
    const extendedSpline: Spline | null = extendSplineToPoint(spline, intersectionPoint, {
      maxExtension: options.maxExtension,
      tolerance: options.tolerance,
      direction: options.extendDirection === 'start' ? 'start' : 
                 options.extendDirection === 'end' ? 'end' : 'auto',
      method: 'linear'
    });

    if (!extendedSpline) {
      return createFailureResult('Failed to extend spline to intersection point');
    }

    // Calculate extension info for the shape extension data
    const extendDirection: 'start' | 'end' | null = determineSplineExtensionDirection(spline, intersectionPoint, {
      maxExtension: options.maxExtension,
      tolerance: options.tolerance,
      direction: options.extendDirection === 'start' ? 'start' : 
                 options.extendDirection === 'end' ? 'end' : 'auto',
      method: 'linear'
    });

    if (!extendDirection) {
      return createFailureResult('Could not determine spline extension direction');
    }

    const extensionInfo: SplineExtensionResult = calculateSplineExtension(spline, intersectionPoint, extendDirection, {
      maxExtension: options.maxExtension,
      tolerance: options.tolerance,
      direction: options.extendDirection === 'start' ? 'start' : 
                 options.extendDirection === 'end' ? 'end' : 'auto',
      method: 'linear'
    });
    if (!extensionInfo.success) {
      return createFailureResult(extensionInfo.error || 'Spline extension calculation failed');
    }

    const extension: ShapeExtension = {
      type: 'parametric',
      amount: extensionInfo.extensionDistance,
      direction: extendDirection,
      originalShape: shape,
      extensionStart: extendDirection === 'start' ? 
        getSplinePoint(spline, 0) : 
        getSplinePoint(spline, 1),
      extensionEnd: intersectionPoint
    };

    const warnings: string[] = [];
    if (extensionInfo.method === 'linear') {
      warnings.push('Spline extended using linear approximation from end tangent');
    }

    return {
      success: true,
      extendedShape: {
        ...shape,
        geometry: extendedSpline
      },
      extension,
      intersectionPoint,
      warnings,
      errors: [],
      confidence: extensionInfo.method === 'parametric' ? 1.0 : 0.8
    };

  } catch (error) {
    return createFailureResult(`Spline extension failed: ${error instanceof Error ? (error as Error).message : String(error)}`);
  }
}


/**
 * Create a failed fill result
 */
function createFailureResult(error: string): FillResult {
  return {
    success: false,
    extendedShape: null,
    warnings: [],
    errors: [error],
    confidence: 0.0
  };
}