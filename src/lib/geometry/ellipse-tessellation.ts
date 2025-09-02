import type { Point2D, Ellipse } from '../types/geometry';

/**
 * Configuration options for ellipse tessellation
 */
export interface EllipseTessellationConfig {
  /** Number of points to generate for tessellation */
  numPoints: number;
  /** Whether to include the start point at the end for closed ellipses (default: false) */
  closePath?: boolean;
}

/**
 * Generate points along an ellipse or ellipse arc using parametric tessellation
 * 
 * This function converts ellipses into polyline approximations by sampling points
 * along the ellipse curve. It handles both full ellipses and ellipse arcs.
 * 
 * @param ellipse The ellipse geometry to tessellate
 * @param config Tessellation configuration
 * @returns Array of points representing the tessellated ellipse
 */
export function tessellateEllipse(ellipse: Ellipse, config: EllipseTessellationConfig): Point2D[] {
  const points: Point2D[] = [];
  
  // Calculate major and minor axis lengths from the ellipse definition
  const majorAxisLength: number = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;
  
  // Calculate rotation angle from the major axis vector
  const rotationAngle: number = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
  
  // Determine if this is an ellipse arc (has parameter range)
  const isArc: boolean = typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number';
  
  if (isArc) {
    // Generate points for ellipse arc
    const startParam: number = ellipse.startParam!;
    const endParam: number = ellipse.endParam!;
    
    // Handle counter-clockwise wrapping when endParam < startParam
    // Ellipse arcs are always counter-clockwise, so when endParam < startParam,
    // we need to wrap around by adding 2π to endParam
    let effectiveEndParam: number = endParam;
    if (endParam < startParam) {
      effectiveEndParam = endParam + 2 * Math.PI;
    }
    
    // Generate points along the parametric curve from startParam to effectiveEndParam
    for (let i: number = 0; i <= config.numPoints; i++) {
      const t: number = startParam + (i / config.numPoints) * (effectiveEndParam - startParam);
      const point: Point2D = evaluateEllipseAtParameter(
        ellipse.center,
        majorAxisLength,
        minorAxisLength,
        rotationAngle,
        t
      );
      points.push(point);
    }
  } else {
    // Generate points for full ellipse
    // Generate points for the ellipse, with optional closure
    for (let i: number = 0; i < config.numPoints; i++) {
      const t: number = (2 * Math.PI * i) / config.numPoints;
      const point: Point2D = evaluateEllipseAtParameter(
        ellipse.center,
        majorAxisLength,
        minorAxisLength,
        rotationAngle,
        t
      );
      points.push(point);
    }
    
    // Add the first point again at the end if closing the path
    if (config.closePath && points.length > 0) {
      points.push({ ...points[0] });
    }
  }
  
  return points;
}

/**
 * Evaluate a point on an ellipse at a given parameter value
 * 
 * Uses the parametric ellipse equation:
 * x = center.x + a*cos(t)*cos(rot) - b*sin(t)*sin(rot)
 * y = center.y + a*cos(t)*sin(rot) + b*sin(t)*cos(rot)
 * 
 * Where:
 * - a = majorAxisLength
 * - b = minorAxisLength  
 * - rot = rotationAngle
 * - t = parameter value
 * 
 * @param center Center point of the ellipse
 * @param majorAxisLength Length of the major axis
 * @param minorAxisLength Length of the minor axis
 * @param rotationAngle Rotation angle of the ellipse in radians
 * @param t Parameter value (0 to 2π for full ellipse)
 * @returns Point on the ellipse at parameter t
 */
export function evaluateEllipseAtParameter(
  center: Point2D,
  majorAxisLength: number,
  minorAxisLength: number,
  rotationAngle: number,
  t: number
): Point2D {
  // Calculate point on axis-aligned ellipse
  const x: number = majorAxisLength * Math.cos(t);
  const y: number = minorAxisLength * Math.sin(t);
  
  // Apply rotation transformation
  const cosRot: number = Math.cos(rotationAngle);
  const sinRot: number = Math.sin(rotationAngle);
  
  const rotatedX: number = x * cosRot - y * sinRot;
  const rotatedY: number = x * sinRot + y * cosRot;
  
  // Translate to ellipse center
  return {
    x: center.x + rotatedX,
    y: center.y + rotatedY
  };
}

/**
 * Calculate the approximate arc length of an ellipse or ellipse arc
 * 
 * Uses Ramanujan's approximation for ellipse arc length, which is accurate
 * for most practical applications.
 * 
 * @param ellipse The ellipse geometry
 * @returns Approximate arc length
 */
export function calculateEllipseArcLength(ellipse: Ellipse): number {
  const majorAxisLength: number = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;
  
  const a: number = Math.max(majorAxisLength, minorAxisLength);
  const b: number = Math.min(majorAxisLength, minorAxisLength);
  
  // Ramanujan's approximation for ellipse circumference
  const h: number = Math.pow((a - b) / (a + b), 2);
  const fullCircumference: number = Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  
  // If this is an arc, calculate the fraction of the full circumference
  const isArc: boolean = typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number';
  if (isArc) {
    const startParam: number = ellipse.startParam!;
    const endParam: number = ellipse.endParam!;
    const parameterRange: number = Math.abs(endParam - startParam);
    const fractionOfFullEllipse: number = parameterRange / (2 * Math.PI);
    return fullCircumference * fractionOfFullEllipse;
  }
  
  return fullCircumference;
}

/**
 * Create adaptive tessellation configuration based on ellipse size and curvature
 * 
 * Automatically determines appropriate number of points based on:
 * - Ellipse size (larger ellipses need more points)
 * - Aspect ratio (more eccentric ellipses need more points)
 * - Target chord tolerance (maximum distance from chord to curve)
 * 
 * @param ellipse The ellipse to tessellate
 * @param chordTolerance Maximum allowed distance from tessellation chords to true curve
 * @param minPoints Minimum number of points (default: 8)
 * @param maxPoints Maximum number of points (default: 200)
 * @returns Adaptive tessellation configuration
 */
export function createAdaptiveTessellationConfig(
  ellipse: Ellipse,
  chordTolerance: number,
  minPoints: number = 8,
  maxPoints: number = 200
): EllipseTessellationConfig {
  const majorAxisLength: number = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  const minorAxisLength: number = majorAxisLength * ellipse.minorToMajorRatio;
  
  // Estimate required points based on curvature and tolerance
  // For an ellipse, the maximum curvature occurs at the end of the minor axis
  // Use minimum radius for most conservative point calculation
  const minRadius: number = Math.min(majorAxisLength, minorAxisLength);
  
  // Approximate chord error for a circular arc: error ≈ r * (1 - cos(θ/2))
  // For small angles: error ≈ r * θ²/8
  // Solving for θ: θ ≈ sqrt(8 * error / r)
  const maxCurvatureRadius: number = minRadius; // Most curved part of ellipse
  const maxAnglePerSegment: number = Math.sqrt(8 * chordTolerance / maxCurvatureRadius);
  
  // Calculate required number of points
  const isArc: boolean = typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number';
  const totalAngle: number = isArc 
    ? Math.abs(ellipse.endParam! - ellipse.startParam!)
    : 2 * Math.PI;
    
  let requiredPoints: number = Math.ceil(totalAngle / maxAnglePerSegment);
  
  // Apply bounds
  requiredPoints = Math.max(minPoints, Math.min(maxPoints, requiredPoints));
  
  // For arcs, we need points along the curve, not including endpoints
  // For full ellipses, we want the specified number of points around the perimeter
  return {
    numPoints: requiredPoints,
    closePath: !isArc // Only close path for full ellipses
  };
}

/**
 * Validate ellipse geometry for tessellation
 * 
 * @param ellipse The ellipse to validate
 * @returns Array of validation error messages (empty if valid)
 */
export function validateEllipseGeometry(ellipse: Ellipse): string[] {
  const errors: string[] = [];
  
  // Check for degenerate major axis
  const majorAxisLength: number = Math.sqrt(
    ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
  );
  
  if (majorAxisLength <= Number.EPSILON) {
    errors.push('Major axis length is zero or negative');
  }
  
  // Check minor to major ratio
  if (ellipse.minorToMajorRatio <= 0) {
    errors.push('Minor to major ratio must be positive');
  }
  
  if (ellipse.minorToMajorRatio > 1) {
    errors.push('Minor to major ratio cannot exceed 1 (minor axis cannot be larger than major axis)');
  }
  
  // Check arc parameters if present
  const hasStartParam: boolean = typeof ellipse.startParam === 'number';
  const hasEndParam: boolean = typeof ellipse.endParam === 'number';
  
  if (hasStartParam !== hasEndParam) {
    errors.push('Both startParam and endParam must be specified for ellipse arcs, or neither for full ellipses');
  }
  
  if (hasStartParam && hasEndParam) {
    const startParam: number = ellipse.startParam!;
    const endParam: number = ellipse.endParam!;
    
    if (!isFinite(startParam) || !isFinite(endParam)) {
      errors.push('Arc parameters must be finite numbers');
    }
    
    if (Math.abs(endParam - startParam) < Number.EPSILON) {
      errors.push('Arc parameter range is too small (start and end parameters are too close)');
    }
  }
  
  return errors;
}