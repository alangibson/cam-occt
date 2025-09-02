import type { Point2D, Circle, Ellipse, Arc, Shape, Line, Polyline, Spline } from '../../../types/geometry';
import type { FillResult } from '../fill/types';
import { EPSILON } from '../../../constants';
import { pointDistance } from '../trim';
import { getEllipseRadiusX, getEllipseRadiusY, getEllipseRotation } from '../../../geometry/ellipse';

/**
 * Fill-Extend Operations Library
 * 
 * Consolidates shared functionality for fill and extend operations on circles and ellipses.
 * This library provides common validation, processing, and transformation utilities
 * that are used by both fill and extend algorithms.
 */


/**
 * Ellipse geometry (simplified interface)
 */
export interface EllipseGeometry {
  center: Point2D;
  radiusX: number;
  radiusY: number;
  rotation?: number;
}

/**
 * Elliptical arc geometry (result of ellipse extension)
 */
export interface EllipticalArcGeometry extends EllipseGeometry {
  startAngle: number;
  endAngle: number;
  clockwise: boolean;
}



/**
 * Extension direction options
 */
export type ExtensionDirection = 'start' | 'end' | 'auto';

/**
 * Base operation parameters
 */
export interface OperationParams {
  /** Geometric tolerance for validation */
  tolerance: number;
  /** Maximum distance/angle to extend */
  maxExtension: number;
  /** Direction to extend */
  extendDirection?: ExtensionDirection;
}

/**
 * Validation result for geometry operations
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  /** Error message if validation failed */
  error?: string;
  /** Distance from shape (for intersection point validation) */
  distance?: number;
}

/**
 * Extension calculation result
 */
export interface ExtensionResult {
  /** Whether the calculation succeeded */
  success: boolean;
  /** Angular extension in radians */
  angularExtension: number;
  /** Direction of extension */
  direction: 'start' | 'end';
  /** Original start angle for the resulting arc */
  originalStartAngle: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Operation result for shape processing
 */
export interface OperationResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Resulting geometry (Arc for circles, EllipticalArc for ellipses) */
  resultGeometry: Arc | EllipticalArcGeometry | null;
  /** Extension information */
  extension: ExtensionResult;
  /** Warnings generated during operation */
  warnings: string[];
  /** Errors encountered during operation */
  errors: string[];
}

// ============================================================================
// ELLIPSE OPERATIONS
// ============================================================================

/**
 * Simplified ellipse geometry interface for internal use
 */
interface SimpleEllipse {
  center: Point2D;
  radiusX: number;
  radiusY: number;
  rotation?: number;
}

/**
 * Extract ellipse properties regardless of ellipse type
 */
function extractEllipseProperties(ellipse: Ellipse | SimpleEllipse) {
  if ('radiusX' in ellipse) {
    return {
      center: ellipse.center,
      radiusX: ellipse.radiusX,
      radiusY: ellipse.radiusY,
      rotation: ellipse.rotation || 0
    };
  } else {
    return {
      center: ellipse.center,
      radiusX: getEllipseRadiusX(ellipse as Ellipse),
      radiusY: getEllipseRadiusY(ellipse as Ellipse),
      rotation: getEllipseRotation(ellipse as Ellipse)
    };
  }
}

/**
 * Validate ellipse operation parameters
 * 
 * @param ellipse - The ellipse geometry to validate (supports both full Ellipse and SimpleEllipse)
 * @param params - Operation parameters
 * @returns Validation result with success/failure information
 */
export function validateEllipseOperation(ellipse: Ellipse | SimpleEllipse, params: OperationParams): ValidationResult {
  try {
    // Check ellipse geometry validity
    const { radiusX, radiusY } = extractEllipseProperties(ellipse);
    
    if (radiusX <= 0 || radiusY <= 0) {
      return { isValid: false, error: 'Ellipse must have positive radii' };
    }
    
    // Check parameters
    if (params.tolerance <= 0) {
      return { isValid: false, error: 'Tolerance must be positive' };
    }
    
    if (params.maxExtension <= 0) {
      return { isValid: false, error: 'Maximum extension must be positive' };
    }
    
    return { isValid: true };
    
  } catch (error) {
    return { 
      isValid: false, 
      error: `Ellipse validation failed: ${error instanceof Error ? (error as Error).message : String(error)}` 
    };
  }
}

/**
 * Check if a point is on the ellipse within tolerance
 * 
 * @param point - Point to check
 * @param ellipse - Ellipse geometry
 * @param tolerance - Geometric tolerance
 * @returns Validation result with distance information
 */
export function validateEllipseIntersectionPoint(
  point: Point2D, 
  ellipse: Ellipse | SimpleEllipse, 
  tolerance: number
): ValidationResult {
  try {
    const { radiusX, radiusY } = extractEllipseProperties(ellipse);
    
    // Transform point to ellipse local coordinates
    const localPoint = transformToEllipseLocal(point, ellipse);
    
    // Calculate distance from ellipse using the ellipse equation
    const ellipseValue = (localPoint.x * localPoint.x) / (radiusX * radiusX) + 
                         (localPoint.y * localPoint.y) / (radiusY * radiusY);
    
    // Distance from ellipse (approximate)
    const distance = Math.abs(ellipseValue - 1) * Math.min(radiusX, radiusY);
    
    return {
      isValid: distance <= tolerance,
      distance,
      error: distance > tolerance ? 
        `Intersection point is not on ellipse (distance: ${distance.toFixed(6)})` : 
        undefined
    };
    
  } catch (error) {
    return { 
      isValid: false, 
      error: `Point validation failed: ${error instanceof Error ? (error as Error).message : String(error)}` 
    };
  }
}

/**
 * Process ellipse operation (fill or extend)
 * 
 * @param ellipse - The ellipse geometry
 * @param intersectionPoint - Target intersection point
 * @param operation - Operation type ('fill' or 'extend')
 * @param params - Operation parameters
 * @returns Operation result with generated geometry
 */
export function processEllipseOperation(
  ellipse: Ellipse | SimpleEllipse, 
  intersectionPoint: Point2D,
  operation: 'fill' | 'extend',
  params: OperationParams
): OperationResult {
  try {
    // Step 1: Validate ellipse
    const validation = validateEllipseOperation(ellipse, params);
    if (!validation.isValid) {
      return {
        success: false,
        resultGeometry: null,
        extension: { success: false, error: validation.error } as ExtensionResult,
        warnings: [],
        errors: [validation.error || 'Ellipse validation failed']
      };
    }
    
    // Step 2: Validate intersection point
    const pointValidation = validateEllipseIntersectionPoint(intersectionPoint, ellipse, params.tolerance);
    if (!pointValidation.isValid) {
      return {
        success: false,
        resultGeometry: null,
        extension: { success: false, error: pointValidation.error } as ExtensionResult,
        warnings: [],
        errors: [pointValidation.error || 'Intersection point validation failed']
      };
    }
    
    // Step 3: Calculate parametric angle of intersection point
    const intersectionAngle = calculateEllipseAngle(intersectionPoint, ellipse);
    
    // Step 4: Determine extension strategy
    const extensionInfo = determineEllipseExtension(ellipse, intersectionAngle, params);
    if (!extensionInfo.success) {
      return {
        success: false,
        resultGeometry: null,
        extension: extensionInfo,
        warnings: [],
        errors: [extensionInfo.error || 'Extension calculation failed']
      };
    }
    
    // Step 5: Create extended elliptical arc
    const resultGeometry = createEllipticalArcFromEllipse(ellipse, intersectionAngle, extensionInfo);
    
    return {
      success: true,
      resultGeometry,
      extension: extensionInfo,
      warnings: [`Ellipse converted to elliptical arc for ${operation}`],
      errors: []
    };
    
  } catch (error) {
    return {
      success: false,
      resultGeometry: null,
      extension: { success: false, error: String(error) } as ExtensionResult,
      warnings: [],
      errors: [`Ellipse ${operation} failed: ${error instanceof Error ? (error as Error).message : String(error)}`]
    };
  }
}

/**
 * Calculate the parametric angle of a point on the ellipse
 */
export function calculateEllipseAngle(point: Point2D, ellipse: Ellipse | SimpleEllipse): number {
  const { radiusX, radiusY } = extractEllipseProperties(ellipse);
  
  // Transform point to ellipse local coordinates
  const localPoint = transformToEllipseLocal(point, ellipse);
  
  // Calculate parametric angle
  return Math.atan2(localPoint.y / radiusY, localPoint.x / radiusX);
}

/**
 * Determine how to extend the ellipse
 */
export function determineEllipseExtension(
  ellipse: Ellipse | SimpleEllipse,
  intersectionAngle: number,
  params: OperationParams
): ExtensionResult {
  try {
    // For ellipses, we need to decide how much of the ellipse to keep as the base
    // and how much to extend. Similar to circles but accounting for elliptical geometry.
    
    const maxAngularExtension = Math.min(2 * Math.PI - EPSILON, Math.PI); // Reasonable default
    
    let angularExtension: number;
    let direction: 'start' | 'end';
    let originalStartAngle: number;
    
    if (params.extendDirection === 'start') {
      // Extend backwards from intersection point
      direction = 'start';
      originalStartAngle = intersectionAngle;
      angularExtension = Math.min(maxAngularExtension, Math.PI / 2); // Default to quarter ellipse
    } else if (params.extendDirection === 'end') {
      // Extend forwards from intersection point
      direction = 'end';
      originalStartAngle = intersectionAngle - Math.min(maxAngularExtension, Math.PI / 2);
      angularExtension = Math.min(maxAngularExtension, Math.PI / 2);
    } else {
      // Auto mode: create a reasonable elliptical arc extension
      direction = 'end';
      originalStartAngle = intersectionAngle - Math.PI / 6; // Start 30 degrees before intersection
      angularExtension = Math.min(maxAngularExtension, Math.PI / 3); // Extend 60 degrees total
    }

    return {
      success: true,
      angularExtension,
      direction,
      originalStartAngle
    };
    
  } catch (error) {
    return {
      success: false,
      angularExtension: 0,
      direction: 'end',
      originalStartAngle: 0,
      error: `Extension calculation failed: ${error instanceof Error ? (error as Error).message : String(error)}`
    };
  }
}

/**
 * Create an elliptical arc from an ellipse with extension
 */
export function createEllipticalArcFromEllipse(
  ellipse: Ellipse | SimpleEllipse,
  intersectionAngle: number,
  extensionInfo: ExtensionResult
): EllipticalArcGeometry {
  const { angularExtension, direction, originalStartAngle } = extensionInfo;
  
  let startAngle: number;
  let endAngle: number;
  
  if (direction === 'start') {
    // Extend backwards from intersection
    startAngle = intersectionAngle - angularExtension;
    endAngle = intersectionAngle;
  } else {
    // Extend forwards from a base position
    startAngle = originalStartAngle;
    endAngle = intersectionAngle + angularExtension;
  }
  
  const { center, radiusX, radiusY, rotation } = extractEllipseProperties(ellipse);
  
  return {
    center: { ...center },
    radiusX,
    radiusY,
    rotation,
    startAngle,
    endAngle,
    clockwise: false // Default to counter-clockwise
  };
}

/**
 * Transform a point from world coordinates to ellipse local coordinates
 */
export function transformToEllipseLocal(point: Point2D, ellipse: Ellipse | SimpleEllipse): Point2D {
  const { center, rotation } = extractEllipseProperties(ellipse);
  
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  
  return applyRotation({ x: dx, y: dy }, -rotation);
}

/**
 * Get a point on the ellipse at a specific parametric angle
 */
export function getEllipsePoint(ellipse: Ellipse | SimpleEllipse, angle: number): Point2D {
  const { center, radiusX, radiusY, rotation } = extractEllipseProperties(ellipse);
  
  // Calculate point on unit ellipse
  const localX = radiusX * Math.cos(angle);
  const localY = radiusY * Math.sin(angle);
  
  // Apply rotation
  const rotatedPoint = applyRotation({ x: localX, y: localY }, rotation);
  
  return {
    x: center.x + rotatedPoint.x,
    y: center.y + rotatedPoint.y
  };
}

// ============================================================================
// CIRCLE OPERATIONS
// ============================================================================

/**
 * Validate circle operation parameters
 * 
 * @param circle - The circle geometry to validate
 * @param params - Operation parameters
 * @returns Validation result with success/failure information
 */
export function validateCircleOperation(circle: Circle, params: OperationParams): ValidationResult {
  try {
    // Check circle geometry validity
    if (!circle.center) {
      return { isValid: false, error: 'Circle must have a valid center point' };
    }
    
    if (circle.radius <= 0) {
      return { isValid: false, error: 'Circle radius must be positive' };
    }
    
    // Check parameters
    if (params.tolerance <= 0) {
      return { isValid: false, error: 'Tolerance must be positive' };
    }
    
    if (params.maxExtension <= 0) {
      return { isValid: false, error: 'Maximum extension must be positive' };
    }
    
    return { isValid: true };
    
  } catch (error) {
    return { 
      isValid: false, 
      error: `Circle validation failed: ${error instanceof Error ? (error as Error).message : String(error)}` 
    };
  }
}

/**
 * Check if a point is on the circle within tolerance
 * 
 * @param point - Point to check
 * @param circle - Circle geometry
 * @param tolerance - Geometric tolerance
 * @returns Validation result with distance information
 */
export function validateCircleIntersectionPoint(
  point: Point2D, 
  circle: Circle, 
  tolerance: number
): ValidationResult {
  try {
    const distanceFromCenter = pointDistance(point, circle.center);
    const radiusTolerance = Math.max(tolerance, circle.radius * 1e-6);
    const distance = Math.abs(distanceFromCenter - circle.radius);
    
    return {
      isValid: distance <= radiusTolerance,
      distance,
      error: distance > radiusTolerance ? 
        `Intersection point is not on circle (distance: ${distanceFromCenter.toFixed(6)}, radius: ${circle.radius.toFixed(6)})` : 
        undefined
    };
    
  } catch (error) {
    return { 
      isValid: false, 
      error: `Point validation failed: ${error instanceof Error ? (error as Error).message : String(error)}` 
    };
  }
}

/**
 * Process circle operation (fill or extend)
 * 
 * @param circle - The circle geometry
 * @param intersectionPoint - Target intersection point
 * @param operation - Operation type ('fill' or 'extend')
 * @param params - Operation parameters
 * @returns Operation result with generated arc geometry
 */
export function processCircleOperation(
  circle: Circle, 
  intersectionPoint: Point2D,
  operation: 'fill' | 'extend',
  params: OperationParams
): OperationResult {
  try {
    // Step 1: Validate circle
    const validation = validateCircleOperation(circle, params);
    if (!validation.isValid) {
      return {
        success: false,
        resultGeometry: null,
        extension: { success: false, error: validation.error } as ExtensionResult,
        warnings: [],
        errors: [validation.error || 'Circle validation failed']
      };
    }
    
    // Step 2: Validate intersection point
    const pointValidation = validateCircleIntersectionPoint(intersectionPoint, circle, params.tolerance);
    if (!pointValidation.isValid) {
      return {
        success: false,
        resultGeometry: null,
        extension: { success: false, error: pointValidation.error } as ExtensionResult,
        warnings: [],
        errors: [pointValidation.error || 'Intersection point validation failed']
      };
    }
    
    // Step 3: Calculate angle of intersection point
    const intersectionAngle = calculateCircleAngle(intersectionPoint, circle);
    
    // Step 4: Determine extension strategy
    const extensionInfo = determineCircleExtension(circle, intersectionAngle, params);
    if (!extensionInfo.success) {
      return {
        success: false,
        resultGeometry: null,
        extension: extensionInfo,
        warnings: [],
        errors: [extensionInfo.error || 'Extension calculation failed']
      };
    }
    
    // Step 5: Create extended arc
    const resultGeometry = createArcFromCircle(circle, intersectionAngle, extensionInfo);
    
    return {
      success: true,
      resultGeometry,
      extension: extensionInfo,
      warnings: [`Circle converted to arc for ${operation}`],
      errors: []
    };
    
  } catch (error) {
    return {
      success: false,
      resultGeometry: null,
      extension: { success: false, error: String(error) } as ExtensionResult,
      warnings: [],
      errors: [`Circle ${operation} failed: ${error instanceof Error ? (error as Error).message : String(error)}`]
    };
  }
}

/**
 * Calculate the angle of a point on the circle
 */
export function calculateCircleAngle(point: Point2D, circle: Circle): number {
  return Math.atan2(
    point.y - circle.center.y,
    point.x - circle.center.x
  );
}

/**
 * Determine how to extend the circle
 */
export function determineCircleExtension(
  circle: Circle,
  intersectionAngle: number,
  params: OperationParams
): ExtensionResult {
  try {
    // For circles, we need to decide how much of the circle to keep as the base
    // and how much to extend. The strategy is to:
    // 1. Start at the intersection point
    // 2. Extend in the direction specified by options, or auto-determine
    
    const maxAngularExtension = Math.min(params.maxExtension / circle.radius, 2 * Math.PI - EPSILON);
    
    let angularExtension: number;
    let direction: 'start' | 'end';
    let originalStartAngle: number;
    
    if (params.extendDirection === 'start') {
      // Extend backwards from intersection point
      direction = 'start';
      originalStartAngle = intersectionAngle;
      angularExtension = Math.min(maxAngularExtension, Math.PI); // Default to half circle
    } else if (params.extendDirection === 'end') {
      // Extend forwards from intersection point
      direction = 'end';
      originalStartAngle = intersectionAngle - Math.min(maxAngularExtension, Math.PI);
      angularExtension = Math.min(maxAngularExtension, Math.PI);
    } else {
      // Auto mode: create a reasonable arc extension
      direction = 'end';
      originalStartAngle = intersectionAngle - Math.PI / 4; // Start 45 degrees before intersection
      angularExtension = Math.min(maxAngularExtension, Math.PI / 2); // Extend 90 degrees total
    }

    return {
      success: true,
      angularExtension,
      direction,
      originalStartAngle
    };
    
  } catch (error) {
    return {
      success: false,
      angularExtension: 0,
      direction: 'end',
      originalStartAngle: 0,
      error: `Extension calculation failed: ${error instanceof Error ? (error as Error).message : String(error)}`
    };
  }
}

/**
 * Create an arc from a circle with extension
 */
export function createArcFromCircle(
  circle: Circle,
  intersectionAngle: number,
  extensionInfo: ExtensionResult
): Arc {
  const { angularExtension, direction, originalStartAngle }: ExtensionResult = extensionInfo;
  
  let startAngle: number;
  let endAngle: number;
  
  if (direction === 'start') {
    // Extend backwards from intersection
    startAngle = intersectionAngle - angularExtension;
    endAngle = intersectionAngle;
  } else {
    // Extend forwards from a base position
    startAngle = originalStartAngle;
    endAngle = intersectionAngle + angularExtension;
  }
  
  return {
    center: { ...circle.center },
    radius: circle.radius,
    startAngle,
    endAngle,
    clockwise: false // Default to counter-clockwise
  };
}

/**
 * Get a point on the circle at a specific angle
 */
export function getCirclePoint(circle: Circle, angle: number): Point2D {
  return {
    x: circle.center.x + circle.radius * Math.cos(angle),
    y: circle.center.y + circle.radius * Math.sin(angle)
  };
}

// ============================================================================
// FILL/EXTEND RESULT PROCESSING
// ============================================================================

/**
 * Process fill/extend operation result and create extension information
 * This consolidates the common logic for handling operation results from both circle and ellipse operations.
 * 
 * @param result - Operation result from processCircleOperation or processEllipseOperation
 * @param shape - Original shape being extended
 * @param intersectionPoint - Target intersection point
 * @param operation - Operation type ('fill' or 'extend')
 * @param getShapePoint - Function to get a point on the shape at a specific angle
 * @returns Processed fill/extend result with extension information
 */
export function processFillExtendResult(
  result: OperationResult, 
  shape: Shape,
  intersectionPoint: Point2D,
  operation: 'fill' | 'extend',
  getShapePoint: (shape: Shape, angle: number) => Point2D
): FillResult {
  if (!result.success || !result.resultGeometry) {
    return {
      success: false,
      extendedShape: null,
      warnings: result.warnings,
      errors: result.errors,
      confidence: 0.0
    };
  }

  // Create extension information
  const extension = {
    type: 'angular' as const,
    amount: result.extension.angularExtension,
    direction: result.extension.direction,
    originalShape: shape,
    extensionStart: getShapePoint(shape, result.extension.originalStartAngle),
    extensionEnd: intersectionPoint
  };

  // Convert the geometry properly based on type
  let geometry: Arc | Line | Circle | Ellipse | Polyline | Spline;
  
  if (shape.type === 'circle') {
    // For circles, result is an Arc
    geometry = result.resultGeometry as Arc;
  } else if (shape.type === 'ellipse') {
    // For ellipses, we need to convert EllipticalArcGeometry back to Ellipse format
    const ellArc: EllipticalArcGeometry = result.resultGeometry as EllipticalArcGeometry;
    geometry = {
      center: ellArc.center,
      majorAxisEndpoint: {
        x: ellArc.center.x + ellArc.radiusX * Math.cos(ellArc.rotation || 0),
        y: ellArc.center.y + ellArc.radiusX * Math.sin(ellArc.rotation || 0)
      },
      minorToMajorRatio: ellArc.radiusY / ellArc.radiusX,
      startParam: ellArc.startAngle,
      endParam: ellArc.endAngle
    } as Ellipse;
  } else {
    // This shouldn't happen, but handle gracefully
    geometry = shape.geometry;
  }

  return {
    success: true,
    extendedShape: {
      ...shape,
      type: shape.type === 'circle' ? 'arc' : 'ellipse',
      geometry
    },
    extension,
    intersectionPoint,
    warnings: result.warnings,
    errors: result.errors,
    confidence: 1.0
  };
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

/**
 * Apply 2D rotation to a point
 */
export function applyRotation(point: Point2D, angle: number): Point2D {
  const cos_r = Math.cos(angle);
  const sin_r = Math.sin(angle);
  
  return {
    x: point.x * cos_r - point.y * sin_r,
    y: point.x * sin_r + point.y * cos_r
  };
}