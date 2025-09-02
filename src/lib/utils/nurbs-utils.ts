/**
 * Validation result for NURBS operations
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Generate a uniform knot vector for NURBS curve
 * This is the standard implementation that consolidates all duplicates across the codebase
 * 
 * @param numControlPoints Number of control points
 * @param degree Degree of the curve
 * @returns Array of knot values forming a uniform clamped knot vector
 */
export function generateUniformKnotVector(numControlPoints: number, degree: number): number[] {
  const validKnots: number[] = [];
  
  // Add degree + 1 zeros at the start (clamping)
  for (let i = 0; i <= degree; i++) {
    validKnots.push(0);
  }
  
  // Add internal knots uniformly spaced
  const numInternalKnots = numControlPoints - degree - 1;
  for (let i = 1; i <= numInternalKnots; i++) {
    validKnots.push(i / (numInternalKnots + 1));
  }
  
  // Add degree + 1 ones at the end (clamping)
  for (let i = 0; i <= degree; i++) {
    validKnots.push(1);
  }
  
  return validKnots;
}

/**
 * Generate a valid knot vector for NURBS curve - alias for backward compatibility
 * @param controlPointsLength Number of control points
 * @param degree Degree of the curve
 * @returns Array of knot values
 */
export function generateValidKnotVector(controlPointsLength: number, degree: number): number[] {
  return generateUniformKnotVector(controlPointsLength, degree);
}

/**
 * Validate a knot vector for NURBS curve
 * Checks if the knot vector has the correct length and is properly formed
 * 
 * @param knots Knot vector to validate
 * @param numControlPoints Number of control points
 * @param degree Curve degree
 * @returns Validation result
 */
export function validateKnotVector(knots: number[], numControlPoints: number, degree: number): ValidationResult {
  const expectedLength = numControlPoints + degree + 1;
  
  if (!knots || !Array.isArray(knots)) {
    return { isValid: false, error: 'Knot vector must be an array' };
  }
  
  if (knots.length !== expectedLength) {
    return { 
      isValid: false, 
      error: `Knot vector length ${knots.length} does not match expected length ${expectedLength}` 
    };
  }
  
  // Check if knots are non-decreasing
  for (let i = 1; i < knots.length; i++) {
    if (knots[i] < knots[i - 1]) {
      return { isValid: false, error: 'Knot vector must be non-decreasing' };
    }
  }
  
  // Check for proper clamping (first and last knots should have multiplicity degree + 1)
  const firstKnot = knots[0];
  const lastKnot = knots[knots.length - 1];
  
  let firstMultiplicity = 0;
  let lastMultiplicity = 0;
  
  for (let i = 0; i < knots.length && knots[i] === firstKnot; i++) {
    firstMultiplicity++;
  }
  
  for (let i = knots.length - 1; i >= 0 && knots[i] === lastKnot; i--) {
    lastMultiplicity++;
  }
  
  if (firstMultiplicity < degree + 1) {
    return { isValid: false, error: `First knot multiplicity ${firstMultiplicity} is less than degree + 1 (${degree + 1})` };
  }
  
  if (lastMultiplicity < degree + 1) {
    return { isValid: false, error: `Last knot multiplicity ${lastMultiplicity} is less than degree + 1 (${degree + 1})` };
  }
  
  return { isValid: true };
}

/**
 * Repair an invalid knot vector by generating a new uniform knot vector
 * This function should be used when validation fails
 * 
 * @param knots Original knot vector (may be invalid)
 * @param numControlPoints Number of control points
 * @param degree Curve degree
 * @returns New valid uniform knot vector
 */
export function repairKnotVector(knots: number[], numControlPoints: number, degree: number): number[] {
  // Always generate a fresh uniform knot vector for repairs
  return generateUniformKnotVector(numControlPoints, degree);
}