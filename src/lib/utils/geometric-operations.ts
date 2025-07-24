/**
 * Geometric Operations using OpenCascade.js
 * 
 * This module provides accurate geometric calculations for shape containment
 * and spatial relationships using OpenCascade.js geometry kernel.
 */

import type { ShapeChain } from '../algorithms/chain-detection';
import type { Shape, Point2D } from '../../types';

// Dynamic import to avoid SSR issues with OpenCascade.js
let openCascade: any = null;

/**
 * Initialize OpenCascade.js if not already loaded
 * Uses Node.js version in test environment, browser version otherwise
 */
async function initializeOpenCascade(): Promise<void> {
  if (!openCascade) {
    try {
      // Check if we're in a Node.js test environment
      if (typeof process !== 'undefined' && process.env?.VITEST) {
        // Use Node.js version for tests
        const { initOpenCascadeForTests } = await import('../test-utils/opencascade-setup.js');
        openCascade = await initOpenCascadeForTests();
      } else {
        // Use browser version for UI
        const opencascadeModule = await import('opencascade.js');
        openCascade = await opencascadeModule.default();
      }
    } catch (error) {
      console.error('Failed to load OpenCascade.js:', error);
      throw new Error('Cannot perform geometric operations: OpenCascade.js failed to load');
    }
  }
}

/**
 * Checks if one closed chain is completely contained within another closed chain
 * using proper geometric containment (not just bounding box)
 */
export async function isChainGeometricallyContained(
  innerChain: ShapeChain, 
  outerChain: ShapeChain
): Promise<boolean> {
  await initializeOpenCascade();
  
  try {
    // Convert both chains to OpenCascade faces
    const innerFace = await convertChainToFace(innerChain);
    const outerFace = await convertChainToFace(outerChain);
    
    if (!innerFace || !outerFace) {
      // Cannot perform geometric containment check without valid faces
      console.warn('Failed to convert chains to faces, returning false (no containment)');
      return false;
    }
    
    // Use OpenCascade's Boolean operations to check containment
    // If inner is completely within outer, then inner - outer should be empty
    // and outer - inner should be equal to outer
    const result = await checkGeometricContainment(innerFace, outerFace);
    
    // Clean up
    innerFace.delete();
    outerFace.delete();
    
    return result;
  } catch (error) {
    console.error('Error in geometric containment check:', error);
    return false;
  }
}

/**
 * Converts a chain to an OpenCascade face for geometric operations
 */
async function convertChainToFace(chain: ShapeChain): Promise<any> {
  if (!openCascade) return null;
  
  try {
    // Create a wire from the chain shapes
    const wire = await convertChainToWire(chain);
    if (!wire) return null;
    
    // Assume wire is closed since our chain detection ensures connectivity
    // TODO: Add proper wire closure check if needed
    
    // Create a face from the closed wire
    const faceBuilder = new openCascade.BRepBuilderAPI_MakeFace_15(wire, true);
    if (!faceBuilder.IsDone()) {
      wire.delete();
      faceBuilder.delete();
      return null;
    }
    
    const face = faceBuilder.Face();
    faceBuilder.delete();
    
    return face;
  } catch (error) {
    console.error('Error converting chain to face:', error);
    return null;
  }
}

/**
 * Converts a chain to an OpenCascade wire
 */
async function convertChainToWire(chain: ShapeChain): Promise<any> {
  if (!openCascade) return null;
  
  try {
    const wireBuilder = new openCascade.BRepBuilderAPI_MakeWire_1();
    
    // Convert each shape in the chain to an edge and add to wire
    for (const shape of chain.shapes) {
      const edge = await convertShapeToEdge(shape);
      if (edge) {
        // Add edge directly to wire builder
        wireBuilder.Add_1(edge);
        edge.delete();
      }
    }
    
    if (!wireBuilder.IsDone()) {
      wireBuilder.delete();
      return null;
    }
    
    const wire = wireBuilder.Wire();
    wireBuilder.delete();
    
    return wire;
  } catch (error) {
    console.error('Error converting chain to wire:', error);
    return null;
  }
}

/**
 * Converts a shape to an OpenCascade edge
 */
async function convertShapeToEdge(shape: Shape): Promise<any> {
  if (!openCascade) return null;

  try {
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        if (!line.start || !line.end || !isFinite(line.start.x) || !isFinite(line.start.y) || 
            !isFinite(line.end.x) || !isFinite(line.end.y)) {
          return null;
        }
        
        const p1 = new openCascade.gp_Pnt_3(line.start.x, line.start.y, 0);
        const p2 = new openCascade.gp_Pnt_3(line.end.x, line.end.y, 0);
        
        // Use direct point-to-point edge creation
        const edge = new openCascade.BRepBuilderAPI_MakeEdge_3(p1, p2);
        
        p1.delete();
        p2.delete();
        
        if (!edge.IsDone()) {
          edge.delete();
          return null;
        }
        
        const lineResult = edge.Edge();
        edge.delete();
        return lineResult;

      case 'circle':
        const circle = shape.geometry as any;
        if (!circle.center || !isFinite(circle.center.x) || !isFinite(circle.center.y) || 
            !isFinite(circle.radius) || circle.radius <= 0) {
          return null;
        }
        
        const center = new openCascade.gp_Pnt_3(circle.center.x, circle.center.y, 0);
        const normal = new openCascade.gp_Dir_4(0, 0, 1);
        const axis = new openCascade.gp_Ax2_3(center, normal);
        const circleGeom = new openCascade.gp_Circ_2(axis, circle.radius);
        const circleEdge = new openCascade.BRepBuilderAPI_MakeEdge_8(circleGeom);
        
        center.delete();
        normal.delete();
        axis.delete();
        circleGeom.delete();
        
        if (!circleEdge.IsDone()) {
          circleEdge.delete();
          return null;
        }
        
        const circleResult = circleEdge.Edge();
        circleEdge.delete();
        return circleResult;

      case 'arc':
        const arc = shape.geometry as any;
        if (!arc.center || !isFinite(arc.center.x) || !isFinite(arc.center.y) || 
            !isFinite(arc.radius) || arc.radius <= 0 ||
            !isFinite(arc.startAngle) || !isFinite(arc.endAngle)) {
          return null;
        }
        
        const arcCenter = new openCascade.gp_Pnt_3(arc.center.x, arc.center.y, 0);
        const arcNormal = new openCascade.gp_Dir_4(0, 0, 1);
        const arcAxis = new openCascade.gp_Ax2_3(arcCenter, arcNormal);
        const arcCircle = new openCascade.gp_Circ_2(arcAxis, arc.radius);
        
        const startParam = arc.startAngle;
        const endParam = arc.endAngle;
        const arcEdge = new openCascade.BRepBuilderAPI_MakeEdge_9(arcCircle, startParam, endParam);
        
        arcCenter.delete();
        arcNormal.delete();
        arcAxis.delete();
        arcCircle.delete();
        
        if (!arcEdge.IsDone()) {
          arcEdge.delete();
          return null;
        }
        
        const arcResult = arcEdge.Edge();
        arcEdge.delete();
        return arcResult;

      case 'polyline':
        const polyline = shape.geometry as any;
        if (!polyline.points || polyline.points.length < 2) return null;

        // For polyline with multiple segments, we need to create multiple edges
        // This is a simplification - ideally we'd handle this in the wire building
        // For now, create an edge from first to last point
        const firstPoint = polyline.points[0];
        const lastPoint = polyline.points[polyline.points.length - 1];
        
        if (!firstPoint || !lastPoint || !isFinite(firstPoint.x) || !isFinite(firstPoint.y) ||
            !isFinite(lastPoint.x) || !isFinite(lastPoint.y)) {
          return null;
        }

        const pt1 = new openCascade.gp_Pnt_3(firstPoint.x, firstPoint.y, 0);
        const pt2 = new openCascade.gp_Pnt_3(lastPoint.x, lastPoint.y, 0);
        
        // Use direct point-to-point edge creation
        const polyEdge = new openCascade.BRepBuilderAPI_MakeEdge_3(pt1, pt2);
        
        pt1.delete();
        pt2.delete();
        
        if (!polyEdge.IsDone()) {
          polyEdge.delete();
          return null;
        }
        
        const polyResult = polyEdge.Edge();
        polyEdge.delete();
        return polyResult;

      default:
        return null;
    }
  } catch (error) {
    console.warn(`Error converting ${shape.type} to OpenCascade edge:`, error);
    return null;
  }
}

/**
 * Creates a dummy face for analysis operations
 */
async function createDummyFace(): Promise<any> {
  if (!openCascade) return null;
  
  // Create a simple square face for analysis
  const p1 = new openCascade.gp_Pnt_3(0, 0, 0);
  const p2 = new openCascade.gp_Pnt_3(1, 0, 0);
  const p3 = new openCascade.gp_Pnt_3(1, 1, 0);
  const p4 = new openCascade.gp_Pnt_3(0, 1, 0);
  
  const wire = new openCascade.BRepBuilderAPI_MakeWire_1();
  
  // Create edges
  const edge1 = new openCascade.BRepBuilderAPI_MakeEdge_3(p1, p2);
  const edge2 = new openCascade.BRepBuilderAPI_MakeEdge_3(p2, p3);
  const edge3 = new openCascade.BRepBuilderAPI_MakeEdge_3(p3, p4);
  const edge4 = new openCascade.BRepBuilderAPI_MakeEdge_3(p4, p1);
  
  wire.Add_1(edge1.Edge());
  wire.Add_1(edge2.Edge());
  wire.Add_1(edge3.Edge());
  wire.Add_1(edge4.Edge());
  
  const face = new openCascade.BRepBuilderAPI_MakeFace_15(wire.Wire(), true);
  
  // Clean up
  p1.delete();
  p2.delete();
  p3.delete();
  p4.delete();
  edge1.delete();
  edge2.delete();
  edge3.delete();
  edge4.delete();
  
  return face.Face();
}

/**
 * Performs geometric containment check using Boolean operations
 * A shape is contained within another if the boolean intersection equals the inner shape
 */
async function checkGeometricContainment(innerFace: any, outerFace: any): Promise<boolean> {
  if (!openCascade) return false;
  
  try {
    // Calculate areas first for basic validation
    const innerArea = await calculateFaceArea(innerFace);
    const outerArea = await calculateFaceArea(outerFace);
    
    // Skip if areas are invalid
    if (innerArea <= 0 || outerArea <= 0) {
      return false;
    }
    
    // Inner cannot be larger than outer
    if (innerArea >= outerArea * 0.99) { // 1% tolerance
      return false;
    }
    
    // Use boolean intersection to test containment
    // Try simpler constructor approach
    try {
      const intersection = new openCascade.BRepAlgoAPI_Common_3(innerFace, outerFace, new openCascade.Message_ProgressRange_1());
      if (!intersection.IsDone()) {
        intersection.delete();
        return false;
      }
      
      const intersectionShape = intersection.Shape();
      const intersectionArea = await calculateFaceArea(intersectionShape);
      
      intersection.delete();
      
      // If intersection area equals inner area (within tolerance), inner is contained within outer
      const areaRatio = Math.abs(innerArea - intersectionArea) / Math.max(innerArea, 1e-10);
      const isContained = areaRatio < 0.05; // 5% tolerance for floating point precision
      
      return isContained;
    } catch (error) {
      console.error('Boolean operation failed:', error);
      return false;
    }
    
  } catch (error) {
    console.error('Error in geometric containment check:', error);
    return false;
  }
}

/**
 * Extracts vertices from a face
 */
async function extractVerticesFromFace(face: any): Promise<any[]> {
  if (!openCascade) return [];
  
  try {
    const vertices: any[] = [];
    const explorer = new openCascade.TopExp_Explorer_2(face, openCascade.TopAbs_ShapeEnum.TopAbs_VERTEX, openCascade.TopAbs_ShapeEnum.TopAbs_SHAPE);
    
    while (explorer.More()) {
      const vertex = openCascade.TopoDS.Vertex_1(explorer.Current());
      vertices.push(vertex);
      explorer.Next();
    }
    
    explorer.delete();
    return vertices;
  } catch (error) {
    console.error('Error extracting vertices:', error);
    return [];
  }
}

/**
 * Checks if all points are inside a face
 */
async function checkAllPointsInside(vertices: any[], face: any): Promise<boolean> {
  if (!openCascade) return false;
  
  try {
    for (const vertex of vertices) {
      const point = openCascade.BRep_Tool.Pnt(vertex);
      const classifier = new openCascade.BRepClass_FaceClassifier_2(face, point, 1e-7);
      const state = classifier.State();
      
      // Point should be IN or ON the face
      if (state !== openCascade.TopAbs_State.TopAbs_IN && 
          state !== openCascade.TopAbs_State.TopAbs_ON) {
        classifier.delete();
        point.delete();
        return false;
      }
      
      classifier.delete();
      point.delete();
    }
    
    return true;
  } catch (error) {
    console.error('Error checking points inside face:', error);
    return false;
  }
}

/**
 * Calculates the area of a face
 */
async function calculateFaceArea(face: any): Promise<number> {
  if (!openCascade) return 0;
  
  try {
    const properties = new openCascade.GProp_GProps_1();
    openCascade.BRepGProp.SurfaceProperties_1(face, properties, 1e-7, true);
    const area = properties.Mass();
    properties.delete();
    return area;
  } catch (error) {
    console.error('Error calculating face area:', error);
    return 0;
  }
}

/**
 * Fallback: Simple point-in-polygon test for emergency cases
 * This is less accurate but doesn't require OpenCascade.js
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  const x = point.x;
  const y = point.y;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}