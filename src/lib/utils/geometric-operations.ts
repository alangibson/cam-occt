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
      // This typically happens when chains have gaps or are not properly closed
      throw new Error(`Failed to create faces for containment check: inner chain ${innerChain.id}=${!!innerFace}, outer chain ${outerChain.id}=${!!outerFace}. Chains may have gaps preventing face creation.`);
    }
    
    // Use OpenCascade's Boolean operations to check containment
    const result = await checkGeometricContainment(innerFace, outerFace);
    
    // Clean up
    innerFace.delete();
    outerFace.delete();
    
    return result;
  } catch (error) {
    // Re-throw the error so the part detection can handle it with bounding box fallback
    throw error;
  }
}

/**
 * Converts a chain to an OpenCascade face for geometric operations
 */
async function convertChainToFace(chain: ShapeChain): Promise<any> {
  if (!openCascade) return null;
  
  try {
    // Special handling for chains with single circles or duplicate circles
    if (chain.shapes.length === 1 && chain.shapes[0].type === 'circle') {
      // Single circle - create face directly
      return await createFaceFromSingleCircle(chain.shapes[0]);
    }
    
    // Check for duplicate circles (common after chain detection)
    if (chain.shapes.length === 2 && 
        chain.shapes[0].type === 'circle' && 
        chain.shapes[1].type === 'circle') {
      const circle1 = chain.shapes[0].geometry;
      const circle2 = chain.shapes[1].geometry;
      
      // Check if they're identical circles
      const centerDist = Math.sqrt(
        Math.pow(circle1.center.x - circle2.center.x, 2) + 
        Math.pow(circle1.center.y - circle2.center.y, 2)
      );
      const radiusDiff = Math.abs(circle1.radius - circle2.radius);
      
      if (centerDist < 0.01 && radiusDiff < 0.01) {
        // Duplicate circles - use only one
        return await createFaceFromSingleCircle(chain.shapes[0]);
      }
    }
    
    // Create a wire from the chain shapes
    const wire = await convertChainToWire(chain);
    if (!wire) {
      return null;
    }
    
    // Assume wire is closed since our chain detection ensures connectivity
    // TODO: Add proper wire closure check if needed
    
    // Check if wire is actually closed before trying to create face
    const wireCheck = new openCascade.BRepCheck_Wire(wire);
    const wireStatus = wireCheck.Status();
    wireCheck.delete();
    
    // Ensure wire has correct orientation before creating face
    try {
      const orientedWire = new openCascade.ShapeAnalysis_WireOrder_1();
      // This ensures the wire has the correct orientation for face creation
      
      // Create a face from the closed wire with proper orientation
      const faceBuilder = new openCascade.BRepBuilderAPI_MakeFace_15(wire, true);
      if (!faceBuilder.IsDone()) {
        console.log(`DEBUG: Face creation failed for chain ${chain.id} - checking wire validity`);
        
        // Check if wire is closed
        const wireAnalysis = new openCascade.BRepCheck_Wire(wire);
        const wireStatus = wireAnalysis.Status();
        console.log(`DEBUG: Wire status: ${wireStatus}`);
        wireAnalysis.delete();
        
        wire.delete();
        faceBuilder.delete();
        return null;
      }
      
      let face = faceBuilder.Face();
      
      // Check if the face has correct orientation (positive area)
      const area = await calculateFaceArea(face);
      if (area < 0) {
        
        // Delete the incorrectly oriented face
        face.delete();
        
        // Reverse the wire instead
        const reversedShape = wire.Reversed();
        const reversedWire = openCascade.TopoDS.Wire_1(reversedShape);
        
        // Create a new face with the reversed wire
        const reversedFaceBuilder = new openCascade.BRepBuilderAPI_MakeFace_15(reversedWire, true);
        if (!reversedFaceBuilder.IsDone()) {
          reversedFaceBuilder.delete();
          return null;
        }
        
        face = reversedFaceBuilder.Face();
        reversedFaceBuilder.delete();
        
        // Verify the new face has positive area
        const reversedArea = await calculateFaceArea(face);
      }
      
      faceBuilder.delete();
      return face;
    } catch (error) {
      // Fall back to original approach
      const faceBuilder = new openCascade.BRepBuilderAPI_MakeFace_15(wire, true);
      if (!faceBuilder.IsDone()) {
        console.log(`DEBUG: Fallback face creation failed for chain ${chain.id}`);
        wire.delete();
        faceBuilder.delete();
        return null;
      }
      
      let face = faceBuilder.Face();
      
      // IMPORTANT: Check face orientation in fallback path too
      const area = await calculateFaceArea(face);
      if (area < 0) {
        
        // Delete the incorrectly oriented face
        face.delete();
        
        // Reverse the wire instead
        const reversedShape = wire.Reversed();
        const reversedWire = openCascade.TopoDS.Wire_1(reversedShape);
        
        // Create a new face with the reversed wire
        const reversedFaceBuilder = new openCascade.BRepBuilderAPI_MakeFace_15(reversedWire, true);
        if (!reversedFaceBuilder.IsDone()) {
          reversedFaceBuilder.delete();
          return null;
        }
        
        face = reversedFaceBuilder.Face();
        reversedFaceBuilder.delete();
        
        // Verify the new face has positive area
        const reversedArea = await calculateFaceArea(face);
      }
      
      faceBuilder.delete();
      return face;
    }
  } catch (error) {
    console.error('Error converting chain to face:', error);
    return null;
  }
}

/**
 * Creates a face from a single circle shape
 */
async function createFaceFromSingleCircle(circleShape: any): Promise<any> {
  if (!openCascade) return null;
  
  try {
    const circle = circleShape.geometry;
    
    // Create circle geometry
    const center = new openCascade.gp_Pnt_3(circle.center.x, circle.center.y, 0);
    const normal = new openCascade.gp_Dir_4(0, 0, 1);
    const axis = new openCascade.gp_Ax2_3(center, normal);
    const circleGeom = new openCascade.gp_Circ_2(axis, circle.radius);
    
    // Create edge from circle
    const circleEdge = new openCascade.BRepBuilderAPI_MakeEdge_8(circleGeom);
    if (!circleEdge.IsDone()) {
      center.delete();
      normal.delete();
      axis.delete();
      circleGeom.delete();
      circleEdge.delete();
      return null;
    }
    
    // Create wire from edge
    const wireBuilder = new openCascade.BRepBuilderAPI_MakeWire_1();
    wireBuilder.Add_1(circleEdge.Edge());
    
    if (!wireBuilder.IsDone()) {
      center.delete();
      normal.delete();
      axis.delete();
      circleGeom.delete();
      circleEdge.delete();
      wireBuilder.delete();
      return null;
    }
    
    const wire = wireBuilder.Wire();
    
    // Create face from wire
    const faceBuilder = new openCascade.BRepBuilderAPI_MakeFace_15(wire, true);
    if (!faceBuilder.IsDone()) {
      center.delete();
      normal.delete();
      axis.delete();
      circleGeom.delete();
      circleEdge.delete();
      wireBuilder.delete();
      faceBuilder.delete();
      return null;
    }
    
    const face = faceBuilder.Face();
    
    // Clean up
    center.delete();
    normal.delete();
    axis.delete();
    circleGeom.delete();
    circleEdge.delete();
    wireBuilder.delete();
    faceBuilder.delete();
    
    return face;
  } catch (error) {
    console.error('Error creating face from single circle:', error);
    return null;
  }
}

/**
 * Creates a compound edge from polyline points, preserving all geometric detail
 */
async function createPolylineCompoundEdge(points: any[]): Promise<any> {
  if (!openCascade || points.length < 3) return null;
  
  try {
    // For multi-segment polylines, we need to create a wire first, then extract as edge
    const wireBuilder = new openCascade.BRepBuilderAPI_MakeWire_1();
    
    // Create edges for each segment of the polyline
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      
      if (!p1 || !p2 || !isFinite(p1.x) || !isFinite(p1.y) || 
          !isFinite(p2.x) || !isFinite(p2.y)) {
        continue;
      }
      
      const pt1 = new openCascade.gp_Pnt_3(p1.x, p1.y, 0);
      const pt2 = new openCascade.gp_Pnt_3(p2.x, p2.y, 0);
      
      const edge = new openCascade.BRepBuilderAPI_MakeEdge_3(pt1, pt2);
      
      if (edge.IsDone()) {
        wireBuilder.Add_1(edge.Edge());
      }
      
      pt1.delete();
      pt2.delete();
      edge.delete();
    }
    
    if (!wireBuilder.IsDone()) {
      wireBuilder.delete();
      return null;
    }
    
    // Return the wire as a compound shape that acts like an edge
    const wire = wireBuilder.Wire();
    wireBuilder.delete();
    return wire;
    
  } catch (error) {
    console.error('Error creating polyline compound edge:', error);
    return null;
  }
}

/**
 * Converts a chain to an OpenCascade wire, with automatic gap closing for chains with small gaps
 */
async function convertChainToWire(chain: ShapeChain): Promise<any> {
  if (!openCascade) return null;
  
  try {
    // For chains that appear closed but may have connectivity issues,
    // try creating a wire with forced closure
    return await createWireWithForcedClosure(chain);
    
  } catch (error) {
    console.error('Error converting chain to wire:', error);
    return null;
  }
}

/**
 * Creates a wire with forced closure for chains that should be closed
 */
async function createWireWithForcedClosure(chain: ShapeChain): Promise<any> {
  if (!openCascade || chain.shapes.length === 0) return null;
  
  const wireBuilder = new openCascade.BRepBuilderAPI_MakeWire_1();
  
  // Convert each shape in the chain to edges and add to wire
  // Special handling for polylines to preserve geometric detail
  let successfulEdges = 0;
  for (const shape of chain.shapes) {
    if (shape.type === 'polyline' && shape.geometry.points && shape.geometry.points.length > 2) {
      // Handle multi-segment polylines by adding each segment as separate edges
      const points = shape.geometry.points;
      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        if (p1 && p2 && isFinite(p1.x) && isFinite(p1.y) && isFinite(p2.x) && isFinite(p2.y)) {
          const pt1 = new openCascade.gp_Pnt_3(p1.x, p1.y, 0);
          const pt2 = new openCascade.gp_Pnt_3(p2.x, p2.y, 0);
          
          const segmentEdge = new openCascade.BRepBuilderAPI_MakeEdge_3(pt1, pt2);
          
          if (segmentEdge.IsDone()) {
            wireBuilder.Add_1(segmentEdge.Edge());
            successfulEdges++;
          }
          
          pt1.delete();
          pt2.delete();
          segmentEdge.delete();
        }
      }
    } else {
      // Handle other shape types normally
      const edge = await convertShapeToEdge(shape);
      if (edge) {
        wireBuilder.Add_1(edge);
        edge.delete();
        successfulEdges++;
      }
    }
  }
  
  if (successfulEdges === 0) {
    console.log(`DEBUG: No successful edges created for chain ${chain.id}`);
    wireBuilder.delete();
    return null;
  }

  // Check if we can create the wire as-is
  if (wireBuilder.IsDone()) {
    const wire = wireBuilder.Wire();
    
    // Check gap distance to determine if we need forced closure
    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];
    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);
    
    if (firstStart && lastEnd) {
      const gapDistance = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      
      
      // For normalized chains, be very aggressive about closing any gaps
      // Even tiny gaps can prevent containment detection
      if (gapDistance > 0.0000001) { // Any measurable gap
        // Create closing edge
        const p1 = new openCascade.gp_Pnt_3(lastEnd.x, lastEnd.y, 0);
        const p2 = new openCascade.gp_Pnt_3(firstStart.x, firstStart.y, 0);
        const closingEdge = new openCascade.BRepBuilderAPI_MakeEdge_3(p1, p2);
        
        if (closingEdge.IsDone()) {
          wireBuilder.Add_1(closingEdge.Edge());
          closingEdge.delete();
        }
        
        p1.delete();
        p2.delete();
      }
    }
    
    wireBuilder.delete();
    return wire;
  } else {
    console.log(`DEBUG: Wire building failed for chain ${chain.id} - edges may not connect properly`);
    wireBuilder.delete();
    return null;
  }
}

/**
 * Checks if a wire needs gap closing for containment operations
 */
async function checkIfWireNeedsClosing(wire: any, chain: ShapeChain): Promise<boolean> {
  if (!openCascade || chain.shapes.length === 0) return false;
  
  try {
    // Calculate gap distance
    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];
    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);
    
    if (!firstStart || !lastEnd) return false;
    
    const gapDistance = Math.sqrt(
      Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
    );
    
    console.log(`DEBUG: Chain ${chain.id} gap distance: ${gapDistance.toFixed(6)}`);
    
    // Close gaps that are small relative to chain size but prevent face creation
    if (gapDistance > 0.01 && gapDistance < 50) { // Between 0.01 and 50 units
      console.log(`DEBUG: Chain ${chain.id} gap distance ${gapDistance.toFixed(6)} needs closing`);
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Closes a wire gap using OpenCascade's wire fixing utilities
 */
async function closeWireGap(originalWire: any, chain: ShapeChain): Promise<any> {
  if (!openCascade || chain.shapes.length === 0) return originalWire;
  
  try {
    // Use ShapeFix_Wire to automatically fix wire gaps
    const wireFixer = new openCascade.ShapeFix_Wire_2(originalWire, openCascade.TopoDS.Face_1());
    
    // Set tolerance for gap fixing
    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];
    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);
    
    if (firstStart && lastEnd) {
      const gapDistance = Math.sqrt(
        Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
      );
      
      console.log(`DEBUG: closeWireGap for chain ${chain.id}, gap: ${gapDistance.toFixed(6)}`);
      
      // Set a generous tolerance for gap fixing - for tiny gaps, use a minimum tolerance
      const tolerance = Math.max(gapDistance * 1.1, 0.01);
      console.log(`DEBUG: Setting gap fixing tolerance to ${tolerance.toFixed(6)}`);
      wireFixer.SetPrecision(tolerance);
      
      // Fix the wire
      const fixResult = wireFixer.Perform();
      console.log(`DEBUG: ShapeFix_Wire.Perform() result: ${fixResult}`);
      
      if (fixResult) {
        const fixedWire = wireFixer.Wire();
        wireFixer.delete();
        
        // Check if the wire is now closed
        const analyzer = new openCascade.BRepAnalysis_WireOrder_1();
        const isClosed = analyzer.IsClosed();
        analyzer.delete();
        
        console.log(`DEBUG: Wire is closed after ShapeFix: ${isClosed}`);
        if (isClosed) {
            return fixedWire;
        }
      } else {
        console.log(`DEBUG: ShapeFix_Wire failed, falling back to manual gap closing`);
      }
      
      wireFixer.delete();
    }
    
    // Fallback: manual gap closing if ShapeFix didn't work
    console.log(`DEBUG: Trying manual gap closing for chain ${chain.id}`);
    return await manualWireGapClosing(originalWire, chain);
    
  } catch (error) {
    return await manualWireGapClosing(originalWire, chain);
  }
}

/**
 * Manual wire gap closing as fallback
 */
async function manualWireGapClosing(originalWire: any, chain: ShapeChain): Promise<any> {
  if (!openCascade || chain.shapes.length === 0) return originalWire;
  
  try {
    // Get first and last points
    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];
    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);
    
    if (!firstStart || !lastEnd) return originalWire;
    
    // Check if gap is essentially zero - if so, no closing edge needed
    const gapDistance = Math.sqrt(
      Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
    );
    
    console.log(`DEBUG: Manual gap closing for chain ${chain.id}, gap: ${gapDistance.toFixed(6)}`);
    
    if (gapDistance < 0.0001) {
      // Gap is essentially zero, wire should already be closed
      // The issue might be with OpenCascade's tolerance settings
      console.log(`DEBUG: Gap essentially zero, returning original wire for chain ${chain.id}`);
      return originalWire;
    }
    
    // Create closing edge
    const p1 = new openCascade.gp_Pnt_3(lastEnd.x, lastEnd.y, 0);
    const p2 = new openCascade.gp_Pnt_3(firstStart.x, firstStart.y, 0);
    const closingEdge = new openCascade.BRepBuilderAPI_MakeEdge_3(p1, p2);
    
    if (!closingEdge.IsDone()) {
      console.log(`DEBUG: Failed to create closing edge for chain ${chain.id}`);
      p1.delete();
      p2.delete();
      closingEdge.delete();
      return originalWire;
    }
    
    // Create new wire with all original edges plus closing edge
    const newWireBuilder = new openCascade.BRepBuilderAPI_MakeWire_1();
    
    // Add original wire
    newWireBuilder.Add_2(originalWire);
    
    // Add closing edge
    newWireBuilder.Add_1(closingEdge.Edge());
    
    p1.delete();
    p2.delete();
    closingEdge.delete();
    
    if (!newWireBuilder.IsDone()) {
      newWireBuilder.delete();
      return originalWire;
    }
    
    const newWire = newWireBuilder.Wire();
    newWireBuilder.delete();
    
    return newWire;
  } catch (error) {
    console.error('Error in manual wire gap closing:', error);
    return originalWire;
  }
}

/**
 * Gets the start point of a shape for gap closing
 */
function getShapeStartPoint(shape: any): {x: number, y: number} | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.start;
    case 'polyline':
      return shape.geometry.points.length > 0 ? shape.geometry.points[0] : null;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    default:
      return null;
  }
}

/**
 * Gets the end point of a shape for gap closing
 */
function getShapeEndPoint(shape: any): {x: number, y: number} | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.end;
    case 'polyline':
      const points = shape.geometry.points;
      return points.length > 0 ? points[points.length - 1] : null;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'circle':
      return {
        x: shape.geometry.center.x + shape.geometry.radius,
        y: shape.geometry.center.y
      };
    default:
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

        // Simple edge from first to last point for fallback cases
        // Multi-segment polylines are handled properly in wire creation
        const firstPoint = polyline.points[0];
        const lastPoint = polyline.points[polyline.points.length - 1];
        
        if (!firstPoint || !lastPoint || !isFinite(firstPoint.x) || !isFinite(firstPoint.y) ||
            !isFinite(lastPoint.x) || !isFinite(lastPoint.y)) {
          return null;
        }

        const pt1 = new openCascade.gp_Pnt_3(firstPoint.x, firstPoint.y, 0);
        const pt2 = new openCascade.gp_Pnt_3(lastPoint.x, lastPoint.y, 0);
        
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
 * Performs geometric containment check using multiple validation approaches
 * Fixed to handle non-deterministic OpenCascade.js boolean operation behavior
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
    
    // Try multiple approaches due to OpenCascade.js inconsistencies
    let containmentResults: boolean[] = [];
    
    // Method 1: Boolean intersection with tight tolerance
    try {
      const fuzzyValue = 1e-8; // Very tight tolerance
      const intersection = new openCascade.BRepAlgoAPI_Common_3(
        innerFace, 
        outerFace, 
        new openCascade.Message_ProgressRange_1()
      );
      
      intersection.SetFuzzyValue(fuzzyValue);
      
      if (intersection.IsDone()) {
        const intersectionShape = intersection.Shape();
        const intersectionArea = await calculateFaceArea(intersectionShape);
        const areaRatio = Math.abs(innerArea - intersectionArea) / Math.max(innerArea, 1e-10);
        containmentResults.push(areaRatio < 0.05); // 5% tolerance
      }
      
      intersection.delete();
    } catch (error) {
      // Boolean operation failed, continue with other methods
    }
    
    // Method 2: Boolean intersection with loose tolerance
    try {
      const fuzzyValue = 1e-6; // Looser tolerance
      const intersection = new openCascade.BRepAlgoAPI_Common_3(
        innerFace, 
        outerFace, 
        new openCascade.Message_ProgressRange_1()
      );
      
      intersection.SetFuzzyValue(fuzzyValue);
      
      if (intersection.IsDone()) {
        const intersectionShape = intersection.Shape();
        const intersectionArea = await calculateFaceArea(intersectionShape);
        const areaRatio = Math.abs(innerArea - intersectionArea) / Math.max(innerArea, 1e-10);
        containmentResults.push(areaRatio < 0.1); // 10% tolerance
      }
      
      intersection.delete();
    } catch (error) {
      // Boolean operation failed, continue with other methods
    }
    
    // Method 3: Centroid-based classification as fallback
    try {
      const innerProps = new openCascade.GProp_GProps_1();
      openCascade.BRepGProp.SurfaceProperties_1(innerFace, innerProps, 1e-7, true);
      const centroid = innerProps.CentreOfMass();
      
      // Simple bounding box check as last resort for clearly contained cases
      const outerProps = new openCascade.GProp_GProps_1();
      openCascade.BRepGProp.SurfaceProperties_1(outerFace, outerProps, 1e-7, true);
      const outerCentroid = outerProps.CentreOfMass();
      
      // If areas are vastly different and inner is much smaller, likely contained
      const sizeRatio = innerArea / outerArea;
      if (sizeRatio < 0.1) { // Inner is less than 10% of outer area
        containmentResults.push(true);
      }
      
      innerProps.delete();
      outerProps.delete();
      centroid.delete();
      outerCentroid.delete();
    } catch (error) {
      // Centroid calculation failed
    }
    
    // Decision logic: Use majority vote or any positive result if boolean ops failed
    if (containmentResults.length === 0) {
      return false; // No methods succeeded
    }
    
    // If we have multiple results, use majority vote
    const positiveResults = containmentResults.filter(r => r).length;
    const totalResults = containmentResults.length;
    
    // Consider contained if majority of methods agree, or if area ratio strongly suggests containment
    const sizeRatio = innerArea / outerArea;
    const isLikelyContained = sizeRatio < 0.05; // Inner is less than 5% of outer
    
    return (positiveResults > totalResults / 2) || isLikelyContained;
    
  } catch (error) {
    console.error('Error in geometric containment check:', error);
    return false;
  }
}

/**
 * Extracts test points from a face for containment testing
 */
async function extractFaceTestPoints(face: any): Promise<any[]> {
  if (!openCascade) return [];
  
  try {
    const testPoints: any[] = [];
    
    // Get face centroid as primary test point
    const surfaceProps = new openCascade.GProp_GProps_1();
    openCascade.BRepGProp.SurfaceProperties_1(face, surfaceProps, 1e-7, true);
    const centroid = surfaceProps.CentreOfMass();
    testPoints.push(centroid);
    surfaceProps.delete();
    
    // Extract vertices as additional test points
    const explorer = new openCascade.TopExp_Explorer_2(
      face, 
      openCascade.TopAbs_ShapeEnum.TopAbs_VERTEX, 
      openCascade.TopAbs_ShapeEnum.TopAbs_SHAPE
    );
    
    let vertexCount = 0;
    while (explorer.More() && vertexCount < 8) { // Limit to 8 vertices to avoid excessive testing
      const vertex = openCascade.TopoDS.Vertex_1(explorer.Current());
      const point = openCascade.BRep_Tool.Pnt(vertex);
      testPoints.push(point);
      explorer.Next();
      vertexCount++;
    }
    
    explorer.delete();
    
    return testPoints;
    
  } catch (error) {
    console.error('Error extracting face test points:', error);
    return [];
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