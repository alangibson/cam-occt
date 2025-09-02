import type { ToolPath, Point2D, Shape } from '../types';
import type { Path } from '../stores/paths';
import { getShapePoints } from '../geometry/shape-utils';

/**
 * Convert a Path from the path store to a ToolPath for G-code generation.
 * Uses offset geometry when available, otherwise falls back to original geometry.
 */
export function pathToToolPath(path: Path, originalShapes: Shape[]): ToolPath {
  // Determine which shapes to use for G-code generation
  const shapesToUse: Shape[] = path.calculatedOffset?.offsetShapes || originalShapes;
  
  // Combine all points from the shapes
  const points: Point2D[] = [];
  shapesToUse.forEach(shape => {
    const shapePoints: Point2D[] = getShapePoints(shape);
    // For the first shape, add all points
    // For subsequent shapes, skip the first point to avoid duplication at connection points
    if (points.length === 0) {
      points.push(...shapePoints);
    } else {
      // Check if the last point of previous shape matches first point of current shape
      const lastPoint: Point2D = points[points.length - 1];
      const firstPoint: Point2D = shapePoints[0];
      const tolerance: number = 0.001;
      
      if (Math.abs(lastPoint.x - firstPoint.x) > tolerance || 
          Math.abs(lastPoint.y - firstPoint.y) > tolerance) {
        // If points don't match, add all points
        points.push(...shapePoints);
      } else {
        // If points match, skip the first point
        points.push(...shapePoints.slice(1));
      }
    }
  });
  
  // Prepare lead-in points if available
  // IMPORTANT: Lead geometry must be recalculated when offset geometry exists
  // to ensure leads connect to the offset path start/end points, not original geometry
  let leadIn: Point2D[] | undefined;
  if (path.calculatedLeadIn?.points && path.calculatedLeadIn.points.length > 0) {
    if (shapesToUse !== originalShapes && points.length > 0) {
      // Using offset geometry - verify lead connects to first point
      const leadEnd: Point2D = path.calculatedLeadIn.points[path.calculatedLeadIn.points.length - 1];
      const pathStart: Point2D = points[0];
      const tolerance: number = 0.1; // Allow small tolerance for connection
      
      if (Math.abs(leadEnd.x - pathStart.x) > tolerance || 
          Math.abs(leadEnd.y - pathStart.y) > tolerance) {
        // Lead doesn't connect properly to offset path - mark for recalculation
        console.warn(`Lead-in doesn't connect to offset path for path ${path.id}. Lead connects to (${leadEnd.x}, ${leadEnd.y}) but path starts at (${pathStart.x}, ${pathStart.y})`);
        leadIn = undefined; // Don't use disconnected lead
      } else {
        leadIn = path.calculatedLeadIn.points;
      }
    } else {
      leadIn = path.calculatedLeadIn.points;
    }
  }
  
  // Prepare lead-out points if available
  let leadOut: Point2D[] | undefined;
  if (path.calculatedLeadOut?.points && path.calculatedLeadOut.points.length > 0) {
    if (shapesToUse !== originalShapes && points.length > 0) {
      // Using offset geometry - verify lead connects to last point
      const leadStart: Point2D = path.calculatedLeadOut.points[0];
      const pathEnd: Point2D = points[points.length - 1];
      const tolerance: number = 0.1; // Allow small tolerance for connection
      
      if (Math.abs(leadStart.x - pathEnd.x) > tolerance || 
          Math.abs(leadStart.y - pathEnd.y) > tolerance) {
        // Lead doesn't connect properly to offset path - mark for recalculation
        console.warn(`Lead-out doesn't connect to offset path for path ${path.id}. Lead connects to (${leadStart.x}, ${leadStart.y}) but path ends at (${pathEnd.x}, ${pathEnd.y})`);
        leadOut = undefined; // Don't use disconnected lead
      } else {
        leadOut = path.calculatedLeadOut.points;
      }
    } else {
      leadOut = path.calculatedLeadOut.points;
    }
  }
  
  // Build cutting parameters from path settings
  const parameters: ToolPath['parameters'] = {
    feedRate: path.feedRate || 1000,
    pierceHeight: path.pierceHeight || 3.8,
    pierceDelay: path.pierceDelay || 0.5,
    cutHeight: 1.5, // Default cut height
    kerf: path.kerfWidth || 0,
    leadInLength: path.leadInLength || 0,
    leadOutLength: path.leadOutLength || 0
  };
  
  return {
    id: path.id,
    shapeId: path.chainId, // Use chainId as the shape reference
    points,
    leadIn,
    leadOut,
    isRapid: false,
    parameters,
    // For native spline/arc commands, we'd need the actual shape
    // This is more complex with offset chains, so omit for now
    originalShape: undefined
  };
}

/**
 * Convert multiple Paths to ToolPaths, preserving cut order
 */
export function pathsToToolPaths(paths: Path[], chainShapes: Map<string, Shape[]>): ToolPath[] {
  const toolPaths: ToolPath[] = [];
  
  // Sort paths by their order field
  const sortedPaths: Path[] = [...paths].sort((a, b) => a.order - b.order);
  
  for (const path of sortedPaths) {
    if (!path.enabled) continue;
    
    const originalShapes: Shape[] | undefined = chainShapes.get(path.chainId);
    if (!originalShapes) continue;
    
    const toolPath: ToolPath = pathToToolPath(path, originalShapes);
    toolPaths.push(toolPath);
  }
  
  // Add rapids between tool paths
  const toolPathsWithRapids: ToolPath[] = [];
  for (let i: number = 0; i < toolPaths.length; i++) {
    toolPathsWithRapids.push(toolPaths[i]);
    
    // Add rapid to next path start if not the last path
    if (i < toolPaths.length - 1) {
      const currentEnd: Point2D = toolPaths[i].points[toolPaths[i].points.length - 1];
      const nextStart: Point2D = toolPaths[i + 1].leadIn 
        ? toolPaths[i + 1].leadIn![0]
        : toolPaths[i + 1].points[0];
      
      // Only add rapid if there's actual movement needed
      const distance: number = Math.sqrt(
        Math.pow(nextStart.x - currentEnd.x, 2) +
        Math.pow(nextStart.y - currentEnd.y, 2)
      );
      
      if (distance > 0.001) {
        toolPathsWithRapids.push({
          id: `rapid-${i}`,
          shapeId: '',
          points: [currentEnd, nextStart],
          isRapid: true,
          parameters: undefined
        });
      }
    }
  }
  
  return toolPathsWithRapids;
}