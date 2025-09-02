import type { Point2D, Line } from '../../../../../lib/types/geometry';
import type { IntersectionResult } from '../../chain/types';
import type { IntersectionType } from '../index';
import { EPSILON } from '../../../../constants';
// Import shared line intersection utilities
import { 
  calculateLineParameterForPoint, 
  isParameterValidForSegment, 
  calculateLineIntersection, 
  type SegmentPosition 
} from '../../../intersection-line-utils';

/**
 * Create parameters for intersection result, handling swap if needed
 * @param param1 Parameter for first line
 * @param param2 Parameter for second line
 * @param swapParams Whether to swap the parameters
 * @returns Object with param1 and param2 properly assigned
 */
function createIntersectionParams(param1: number, param2: number, swapParams: boolean): { param1: number; param2: number } {
  return swapParams ? { param1: param2, param2: param1 } : { param1, param2 };
}

/**
 * Find intersections between two line segments
 * Handles parallel and collinear cases precisely
 */
export function findLineLineIntersections(
  line1: Line, 
  line2: Line, 
  swapParams: boolean = false, 
  allowExtensions: boolean = false, 
  extensionLength: number = 1000,
  intersectionType: IntersectionType = 'infinite'
): IntersectionResult[] {
  // First try intersection with original shapes
  const originalResults: IntersectionResult[] = findLineLineIntersectionsCore(line1, line2, swapParams);
  
  // Filter results based on intersection type
  let filteredResults = originalResults;
  if (intersectionType === 'true') {
    // Only return intersections where both parameters are within [0, 1] bounds
    filteredResults = originalResults.filter(result => {
      const isWithinLine1: boolean = result.param1 >= 0 && result.param1 <= 1;
      const isWithinLine2: boolean = result.param2 >= 0 && result.param2 <= 1;
      return isWithinLine1 && isWithinLine2;
    });
  }
  
  if (!allowExtensions) {
    return filteredResults;
  }
  
  // Check if any original intersections are within both line segments
  const validOriginalResults: IntersectionResult[] = originalResults.filter(result => {
    const isWithinLine1: boolean = result.param1 >= 0 && result.param1 <= 1;
    const isWithinLine2: boolean = result.param2 >= 0 && result.param2 <= 1;
    return isWithinLine1 && isWithinLine2;
  });
  
  if (validOriginalResults.length > 0) {
    return validOriginalResults;
  }
  
  // Mark any original intersections that are outside segment bounds as extensions
  // But also check if they're within the specified extension length
  const extensionResults: IntersectionResult[] = originalResults.filter(result => {
    const isWithinLine1: boolean = result.param1 >= 0 && result.param1 <= 1;
    const isWithinLine2: boolean = result.param2 >= 0 && result.param2 <= 1;
    const needsExtension: boolean = !isWithinLine1 || !isWithinLine2;
    
    if (!needsExtension) {
      // Intersection is within both segments, always include
      return true;
    }
    
    // Check if the extension required is within the allowed length
    const line1Length = Math.sqrt(
      Math.pow(line1.end.x - line1.start.x, 2) + 
      Math.pow(line1.end.y - line1.start.y, 2)
    );
    const line2Length = Math.sqrt(
      Math.pow(line2.end.x - line2.start.x, 2) + 
      Math.pow(line2.end.y - line2.start.y, 2)
    );
    
    // Calculate how much extension is needed
    let line1Extension: number = 0;
    let line2Extension: number = 0;
    
    if (result.param1 < 0) {
      line1Extension = Math.abs(result.param1) * line1Length;
    } else if (result.param1 > 1) {
      line1Extension = (result.param1 - 1) * line1Length;
    }
    
    if (result.param2 < 0) {
      line2Extension = Math.abs(result.param2) * line2Length;
    } else if (result.param2 > 1) {
      line2Extension = (result.param2 - 1) * line2Length;
    }
    
    // Check if both required extensions are within the allowed length
    const withinExtensionLimit: boolean = line1Extension <= extensionLength && line2Extension <= extensionLength;
    
    return withinExtensionLimit;
  }).map(result => {
    const isWithinLine1: boolean = result.param1 >= 0 && result.param1 <= 1;
    const isWithinLine2: boolean = result.param2 >= 0 && result.param2 <= 1;
    const needsExtension: boolean = !isWithinLine1 || !isWithinLine2;
    
    return {
      ...result,
      onExtension: needsExtension
    };
  });
  
  return extensionResults;
}

/**
 * Core line-line intersection logic without extension handling
 */
function findLineLineIntersectionsCore(
  line1: Line, 
  line2: Line, 
  swapParams: boolean = false,
  onExtension: boolean = false
): IntersectionResult[] {
  // Use shared utility for basic intersection calculation
  const results = calculateLineIntersection(line1, line2);
  
  if (results.length === 0) {
    // No intersection or parallel lines
    return handleParallelLines(line1, line2, swapParams, onExtension);
  }

  // Apply parameter swapping and extension flag
  return results.map(result => {
    const params = createIntersectionParams(result.param1, result.param2, swapParams);
    return {
      ...result,
      param1: params.param1,
      param2: params.param2,
      onExtension
    };
  });
}

/**
 * Handle parallel line intersection cases
 * Returns overlapping segments for collinear lines
 */
function handleParallelLines(line1: Line, line2: Line, swapParams: boolean = false, onExtension: boolean = false): IntersectionResult[] {
  // Check if lines are collinear by testing if all points lie on the same line
  const { start: p1, end: p2 } = line1;
  const { start: p3, end: p4 } = line2;

  // Calculate cross products to check collinearity
  const cross1: number = (p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x);
  const cross2: number = (p4.x - p1.x) * (p2.y - p1.y) - (p4.y - p1.y) * (p2.x - p1.x);

  if (Math.abs(cross1) < EPSILON && Math.abs(cross2) < EPSILON) {
    // Lines are collinear, find overlap
    return findCollinearOverlap(line1, line2, swapParams, onExtension);
  }

  return []; // Parallel but not collinear
}

/**
 * Find overlap region between collinear line segments
 */
function findCollinearOverlap(line1: Line, line2: Line, swapParams: boolean = false, onExtension: boolean = false): IntersectionResult[] {
  const dx: number = line1.end.x - line1.start.x;
  const dy: number = line1.end.y - line1.start.y;
  const lineLength: number = Math.sqrt(dx * dx + dy * dy);

  if (lineLength < EPSILON) {
    // First line is a point
    return [];
  }

  // Project all points onto line1's direction vector
  const proj1Start: number = 0; // line1 start
  const proj1End: number = lineLength; // line1 end in its own units
  const proj2Start: number = ((line2.start.x - line1.start.x) * dx + (line2.start.y - line1.start.y) * dy) / lineLength;
  const proj2End: number = ((line2.end.x - line1.start.x) * dx + (line2.end.y - line1.start.y) * dy) / lineLength;

  // Find overlap region
  const overlapStart: number = Math.max(proj1Start, Math.min(proj2Start, proj2End));
  const overlapEnd: number = Math.min(proj1End, Math.max(proj2Start, proj2End));

  if (overlapStart <= overlapEnd + EPSILON) {
    // There is overlap
    const results: IntersectionResult[] = [];
    
    // Add overlap endpoints as intersections
    if (overlapStart >= -EPSILON && overlapStart <= lineLength + EPSILON) {
      const point: Point2D = {
        x: line1.start.x + (overlapStart / lineLength) * dx,
        y: line1.start.y + (overlapStart / lineLength) * dy
      };
      const params = createIntersectionParams(overlapStart / lineLength, calculateLineParameterForPoint(point, line2), swapParams);
      results.push({
        point,
        param1: params.param1,
        param2: params.param2,
        distance: 0,
        type: 'coincident',
        confidence: 1.0,
        onExtension
      });
    }

    if (overlapEnd >= -EPSILON && overlapEnd <= lineLength + EPSILON && 
        Math.abs(overlapEnd - overlapStart) > EPSILON) {
      const point: Point2D = {
        x: line1.start.x + (overlapEnd / lineLength) * dx,
        y: line1.start.y + (overlapEnd / lineLength) * dy
      };
      const params = createIntersectionParams(overlapEnd / lineLength, calculateLineParameterForPoint(point, line2), swapParams);
      results.push({
        point,
        param1: params.param1,
        param2: params.param2,
        distance: 0,
        type: 'coincident',
        confidence: 1.0,
        onExtension
      });
    }

    return results;
  }

  return [];
}






/**
 * Find intersections between two line segments with segment position awareness
 * For polyline intersections, this ensures extended intersections only apply to endpoint segments
 */
export function findLineLineIntersectionsSegmentAware(
  line1: Line, 
  line2: Line, 
  segment1Position: SegmentPosition = 'only',
  segment2Position: SegmentPosition = 'only',
  intersectionType: IntersectionType = 'infinite'
): IntersectionResult[] {
  // Use shared utility for basic intersection calculation
  const results = calculateLineIntersection(line1, line2);
  
  if (results.length === 0) {
    // No intersection (parallel lines)
    return findLineLineIntersections(line1, line2, false, false, 1000, intersectionType);
  }

  // Filter results based on segment position validity and intersection type
  return results.filter(result => {
    // First check intersection type requirement
    if (intersectionType === 'true') {
      const isWithinLine1: boolean = result.param1 >= 0 && result.param1 <= 1;
      const isWithinLine2: boolean = result.param2 >= 0 && result.param2 <= 1;
      if (!isWithinLine1 || !isWithinLine2) {
        return false;
      }
    }
    
    // Then check segment position validity
    const t1Valid = isParameterValidForSegment(result.param1, segment1Position);
    const t2Valid = isParameterValidForSegment(result.param2, segment2Position);
    return t1Valid && t2Valid;
  });
}