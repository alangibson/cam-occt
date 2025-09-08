import type { ToolPath, Point2D, Shape } from '../types';
import type { Path } from '../stores/paths';
import type { Tool } from '../stores/tools';
import { getShapePoints } from '../geometry/shape-utils';
import { hasValidCachedLeads, getCachedLeadGeometry } from '../utils/lead-persistence-utils';
import { calculateLeads, type LeadInConfig, type LeadOutConfig } from '../algorithms/lead-calculation';
import { LeadType } from '../types/direction';
import type { Chain } from '../algorithms/chain-detection/chain-detection';
import type { DetectedPart } from '../algorithms/part-detection';

/**
 * Convert a Path from the path store to a ToolPath for G-code generation.
 * Uses simulation's validated geometry resolution approach:
 * 1. path.cutChain?.shapes (preferred - execution-ordered shapes)
 * 2. path.calculatedOffset?.offsetShapes (fallback - offset geometry)
 * 3. originalShapes (final fallback)
 */
export function pathToToolPath(path: Path, originalShapes: Shape[], tools: Tool[], chainMap?: Map<string, Chain>, partMap?: Map<string, DetectedPart>): ToolPath {
  // Use simulation's validated geometry resolution approach
  // Priority: cutChain > calculatedOffset > original shapes
  let shapesToUse: Shape[];
  
  // First priority: Use execution chain if available (contains shapes in correct execution order)
  if (path.cutChain && path.cutChain.shapes.length > 0) {
    shapesToUse = path.cutChain.shapes;
  } else {
    // Second priority: Use offset shapes if available, otherwise fall back to original
    shapesToUse = path.calculatedOffset?.offsetShapes || originalShapes;
  }
  
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
  
  // Prepare lead-in points using both simulation and legacy approaches
  let leadIn: Point2D[] | undefined;
  
  // First check for existing calculatedLeadIn (backward compatibility)
  if (path.calculatedLeadIn?.points && path.calculatedLeadIn.points.length > 0) {
    if (shapesToUse !== originalShapes && points.length > 0) {
      // Using offset geometry - verify lead connects to first point
      const leadEnd: Point2D = path.calculatedLeadIn.points[path.calculatedLeadIn.points.length - 1];
      const pathStart: Point2D = points[0];
      const tolerance: number = 0.1; // Allow small tolerance for connection
      
      if (Math.abs(leadEnd.x - pathStart.x) <= tolerance && 
          Math.abs(leadEnd.y - pathStart.y) <= tolerance) {
        leadIn = path.calculatedLeadIn.points;
      } else {
        console.warn(`Cached lead-in doesn't connect to offset path for path ${path.id}. Lead connects to (${leadEnd.x}, ${leadEnd.y}) but path starts at (${pathStart.x}, ${pathStart.y})`);
        leadIn = undefined; // Don't use disconnected lead
      }
    } else {
      leadIn = path.calculatedLeadIn.points;
    }
  }
  // If no calculatedLeadIn, try simulation's approach with leadInType/Length
  else if (path.leadInType && path.leadInType !== LeadType.NONE && path.leadInLength && path.leadInLength > 0) {
    // First try to use cached lead geometry (simulation's approach)
    if (hasValidCachedLeads(path)) {
      const cached = getCachedLeadGeometry(path);
      if (cached.leadIn && cached.leadIn.points.length > 0) {
        // Verify cached lead connects properly to current geometry
        const leadEnd: Point2D = cached.leadIn.points[cached.leadIn.points.length - 1];
        const pathStart: Point2D = points[0];
        const tolerance: number = 0.1;
        
        if (Math.abs(leadEnd.x - pathStart.x) <= tolerance && 
            Math.abs(leadEnd.y - pathStart.y) <= tolerance) {
          leadIn = cached.leadIn.points;
        } else {
          console.warn(`Cached lead-in doesn't connect to current geometry for path ${path.id}`);
          leadIn = undefined; // Will trigger recalculation below
        }
      }
    }
    
    // Fallback to calculating if no valid cache (simulation's approach)
    if (!leadIn && chainMap && partMap) {
      try {
        const chain = chainMap.get(path.chainId);
        if (chain) {
          const part = partMap.get(path.chainId); // Part lookup for lead fitting
          
          // Use offset shapes for lead calculation if available (simulation's approach)
          const chainForLeads = path.calculatedOffset ? 
            { ...chain, shapes: path.calculatedOffset.offsetShapes } : chain;
          
          const leadInConfig: LeadInConfig = {
            type: path.leadInType,
            length: path.leadInLength,
            flipSide: path.leadInFlipSide || false,
            angle: path.leadInAngle
          };
          const leadOutConfig: LeadOutConfig = {
            type: path.leadOutType || LeadType.NONE,
            length: path.leadOutLength || 0,
            flipSide: path.leadOutFlipSide || false,
            angle: path.leadOutAngle
          };
          
          const leadResult = calculateLeads(chainForLeads, leadInConfig, leadOutConfig, path.cutDirection, part);
          
          if (leadResult.leadIn && leadResult.leadIn.points.length > 0) {
            leadIn = leadResult.leadIn.points;
          }
        }
      } catch (error) {
        console.warn('Failed to calculate lead-in for G-code generation:', path.name, error);
      }
    }
  }
  
  // Prepare lead-out points using both simulation and legacy approaches  
  let leadOut: Point2D[] | undefined;
  
  // First check for existing calculatedLeadOut (backward compatibility)
  if (path.calculatedLeadOut?.points && path.calculatedLeadOut.points.length > 0) {
    if (shapesToUse !== originalShapes && points.length > 0) {
      // Using offset geometry - verify lead connects to last point
      const leadStart: Point2D = path.calculatedLeadOut.points[0];
      const pathEnd: Point2D = points[points.length - 1];
      const tolerance: number = 0.1; // Allow small tolerance for connection
      
      if (Math.abs(leadStart.x - pathEnd.x) <= tolerance && 
          Math.abs(leadStart.y - pathEnd.y) <= tolerance) {
        leadOut = path.calculatedLeadOut.points;
      } else {
        console.warn(`Cached lead-out doesn't connect to offset path for path ${path.id}. Lead connects to (${leadStart.x}, ${leadStart.y}) but path ends at (${pathEnd.x}, ${pathEnd.y})`);
        leadOut = undefined; // Don't use disconnected lead
      }
    } else {
      leadOut = path.calculatedLeadOut.points;
    }
  }
  // If no calculatedLeadOut, try simulation's approach with leadOutType/Length
  else if (path.leadOutType && path.leadOutType !== LeadType.NONE && path.leadOutLength && path.leadOutLength > 0) {
    // First try to use cached lead geometry (simulation's approach)
    if (hasValidCachedLeads(path)) {
      const cached = getCachedLeadGeometry(path);
      if (cached.leadOut && cached.leadOut.points.length > 0) {
        // Verify cached lead connects properly to current geometry
        const leadStart: Point2D = cached.leadOut.points[0];
        const pathEnd: Point2D = points[points.length - 1];
        const tolerance: number = 0.1;
        
        if (Math.abs(leadStart.x - pathEnd.x) <= tolerance && 
            Math.abs(leadStart.y - pathEnd.y) <= tolerance) {
          leadOut = cached.leadOut.points;
        } else {
          console.warn(`Cached lead-out doesn't connect to current geometry for path ${path.id}`);
          leadOut = undefined; // Will trigger recalculation below
        }
      }
    }
    
    // Fallback to calculating if no valid cache (simulation's approach)
    if (!leadOut && chainMap && partMap) {
      try {
        const chain = chainMap.get(path.chainId);
        if (chain) {
          const part = partMap.get(path.chainId); // Part lookup for lead fitting
          
          // Use offset shapes for lead calculation if available (simulation's approach)
          const chainForLeads = path.calculatedOffset ? 
            { ...chain, shapes: path.calculatedOffset.offsetShapes } : chain;
          
          const leadInConfig: LeadInConfig = {
            type: path.leadInType || LeadType.NONE,
            length: path.leadInLength || 0,
            flipSide: path.leadInFlipSide || false,
            angle: path.leadInAngle
          };
          const leadOutConfig: LeadOutConfig = {
            type: path.leadOutType,
            length: path.leadOutLength,
            flipSide: path.leadOutFlipSide || false,
            angle: path.leadOutAngle
          };
          
          const leadResult = calculateLeads(chainForLeads, leadInConfig, leadOutConfig, path.cutDirection, part);
          
          if (leadResult.leadOut && leadResult.leadOut.points.length > 0) {
            leadOut = leadResult.leadOut.points;
          }
        }
      } catch (error) {
        console.warn('Failed to calculate lead-out for G-code generation:', path.name, error);
      }
    }
  }
  
  // Build cutting parameters from tool settings
  const tool = path.toolId ? tools.find(t => t.id === path.toolId) : null;
  const parameters: ToolPath['parameters'] = {
    feedRate: tool?.feedRate || 1000,
    pierceHeight: tool?.pierceHeight || 3.8,
    pierceDelay: tool?.pierceDelay || 0.5,
    cutHeight: 1.5, // Default cut height
    kerf: tool?.kerfWidth || 0,
    leadInLength: path.leadInLength || 0,
    leadOutLength: path.leadOutLength || 0,
    isHole: path.isHole || false,
    holeUnderspeedPercent: path.holeUnderspeedPercent
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
 * Uses simulation's validated approach for geometry resolution
 */
export function pathsToToolPaths(
  paths: Path[], 
  chainShapes: Map<string, Shape[]>,
  tools: Tool[],
  chainMap?: Map<string, Chain>, 
  partMap?: Map<string, DetectedPart>
): ToolPath[] {
  const toolPaths: ToolPath[] = [];
  
  // Sort paths by their order field
  const sortedPaths: Path[] = [...paths].sort((a, b) => a.order - b.order);
  
  for (const path of sortedPaths) {
    if (!path.enabled) continue;
    
    const originalShapes: Shape[] | undefined = chainShapes.get(path.chainId);
    if (!originalShapes) continue;
    
    const toolPath: ToolPath = pathToToolPath(path, originalShapes, tools, chainMap, partMap);
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