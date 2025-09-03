import type { Chain } from '../chain-detection/chain-detection';
import type { Polyline, Shape, Line, Point2D } from '../../types/geometry';
import type { JoinColinearLinesParameters } from '../../types/algorithm-parameters';
import { TOLERANCE } from '../../constants';

/**
 * Primary function to join collinear lines in chains with configurable parameters
 * This is the main entry point that should be used by the UI
 */
export function joinColinearLines(chains: Chain[], parameters: JoinColinearLinesParameters): Chain[] {
  return joinColinearLinesInChains(chains, parameters.tolerance);
}

/**
 * Check if three points are collinear within tolerance
 * Uses cross product to measure deviation from collinearity
 */
function arePointsCollinear(p1: Point2D, p2: Point2D, p3: Point2D, tolerance: number): boolean {
  // Calculate cross product to measure deviation from collinearity
  const crossProduct: number = Math.abs(
    (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)
  );
  
  return crossProduct <= tolerance;
}

/**
 * Check if two line segments are collinear and can be joined
 */
function canJoinLines(line1: Line, line2: Line, tolerance: number): boolean {
  // Check if all four points are collinear by testing if they all lie on the same line
  // For all points to be collinear, line2's points must lie on the infinite line defined by line1
  return arePointsCollinear(line1.start, line1.end, line2.start, tolerance) &&
         arePointsCollinear(line1.start, line1.end, line2.end, tolerance);
}

/**
 * Create a new line that spans from the start of the first line to the end of the last line
 * in a sequence of collinear lines
 */
function createJoinedLine(lines: Line[]): Line {
  if (lines.length === 0) {
    throw new Error('Cannot join empty array of lines');
  }
  
  if (lines.length === 1) {
    return lines[0];
  }
  
  // Find the actual start and end points across all lines
  // We need to determine the correct direction of the joined line
  const allPoints: Point2D[] = [];
  lines.forEach(line => {
    allPoints.push(line.start, line.end);
  });
  
  // Find the two points that are furthest apart - these will be our new start/end
  let maxDistance = 0;
  let startPoint: Point2D = allPoints[0];
  let endPoint: Point2D = allPoints[1];
  
  for (let i = 0; i < allPoints.length; i++) {
    for (let j = i + 1; j < allPoints.length; j++) {
      const dx = allPoints[j].x - allPoints[i].x;
      const dy = allPoints[j].y - allPoints[i].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > maxDistance) {
        maxDistance = distance;
        startPoint = allPoints[i];
        endPoint = allPoints[j];
      }
    }
  }
  
  return {
    start: startPoint,
    end: endPoint
  };
}

/**
 * Join consecutive collinear line segments within a polyline
 */
function joinColinearLinesInPolyline(polyline: Polyline, tolerance: number = TOLERANCE): Polyline {
  if (!polyline.shapes || polyline.shapes.length === 0) {
    return polyline;
  }
  
  const newShapes: Shape[] = [];
  let i = 0;
  
  while (i < polyline.shapes.length) {
    const currentShape = polyline.shapes[i];
    
    // If not a line, just add it and continue
    if (currentShape.type !== 'line') {
      newShapes.push(currentShape);
      i++;
      continue;
    }
    
    // Collect consecutive collinear lines, checking against the original start line
    const startLine = currentShape.geometry as Line;
    const collinearLines: Line[] = [startLine];
    let j = i + 1;
    
    while (j < polyline.shapes.length) {
      const nextShape = polyline.shapes[j];
      
      // Stop if not a line
      if (nextShape.type !== 'line') {
        break;
      }
      
      const nextLine = nextShape.geometry as Line;
      
      // CRITICAL: Check if this line is collinear with the ORIGINAL start line, not just the previous line
      // This ensures total deviation from perfect collinearity is not more than tolerance
      if (!canJoinLines(startLine, nextLine, tolerance)) {
        break;
      }
      
      collinearLines.push(nextLine);
      j++;
    }
    
    // If we found multiple collinear lines, join them
    if (collinearLines.length > 1) {
      const joinedLine = createJoinedLine(collinearLines);
      newShapes.push({
        ...currentShape, // Preserve id, layer, etc. from first shape
        geometry: joinedLine
      });
    } else {
      // Single line, just add it
      newShapes.push(currentShape);
    }
    
    // Move to next unprocessed shape
    i = j;
  }
  
  return {
    ...polyline,
    shapes: newShapes
  };
}

/**
 * Join consecutive collinear lines within each chain
 */
function joinColinearLinesInChains(chains: Chain[], tolerance: number = TOLERANCE): Chain[] {
  return chains.map(chain => ({
    ...chain,
    shapes: joinColinearLinesInShapes(chain.shapes, tolerance)
  }));
}

/**
 * Join consecutive collinear lines in an array of shapes
 * This handles both regular shapes and polylines containing line segments
 */
function joinColinearLinesInShapes(shapes: Shape[], tolerance: number): Shape[] {
  const newShapes: Shape[] = [];
  let i = 0;
  
  while (i < shapes.length) {
    const currentShape = shapes[i];
    
    // Handle polylines specially
    if (currentShape.type === 'polyline') {
      const joinedPolyline = joinColinearLinesInPolyline(
        currentShape.geometry as Polyline, 
        tolerance
      );
      newShapes.push({
        ...currentShape,
        geometry: joinedPolyline
      });
      i++;
      continue;
    }
    
    const result = processConsecutiveLines(shapes, i, tolerance);
    newShapes.push(...result.shapes);
    i = result.nextIndex;
  }
  
  return newShapes;
}

/**
 * Process consecutive collinear lines starting from a given index
 * Returns the processed shapes and the next index to continue from
 */
function processConsecutiveLines(shapes: Shape[], startIndex: number, tolerance: number): {
  shapes: Shape[];
  nextIndex: number;
} {
  const currentShape = shapes[startIndex];
  
  // If not a line, just add it and continue
  if (currentShape.type !== 'line') {
    return {
      shapes: [currentShape],
      nextIndex: startIndex + 1
    };
  }
  
  // Collect consecutive collinear lines, checking against the original start line
  const startLine = currentShape.geometry as Line;
  const collinearLines: Line[] = [startLine];
  let j = startIndex + 1;
  
  while (j < shapes.length) {
    const nextShape = shapes[j];
    
    // Stop if not a line
    if (nextShape.type !== 'line') {
      break;
    }
    
    const nextLine = nextShape.geometry as Line;
    
    // CRITICAL: Check if this line is collinear with the ORIGINAL start line, not just the previous line
    // This ensures total deviation from perfect collinearity is not more than tolerance
    if (!canJoinLines(startLine, nextLine, tolerance)) {
      break;
    }
    
    collinearLines.push(nextLine);
    j++;
  }
  
  // If we found multiple collinear lines, join them
  if (collinearLines.length > 1) {
    const joinedLine = createJoinedLine(collinearLines);
    return {
      shapes: [{
        ...currentShape, // Preserve id, layer, etc. from first shape
        geometry: joinedLine
      }],
      nextIndex: j
    };
  } else {
    // Single line, just add it
    return {
      shapes: [currentShape],
      nextIndex: j
    };
  }
}