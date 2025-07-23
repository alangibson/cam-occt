import type { Drawing, Shape } from '../../types';

export interface DrawingSize {
  width: number;
  height: number;
  units: string;
  source: 'dxf' | 'calculated';
}

// Dynamic import to avoid SSR issues with OpenCascade.js
let openCascade: any = null;

export async function calculateDrawingSize(drawing: Drawing | null): Promise<DrawingSize | null> {
  if (!drawing || drawing.shapes.length === 0) {
    return null;
  }

  // First, check if DXF has explicit size information
  // TODO: Parse DXF header for explicit dimensions in future
  
  // Check if the bounds from DXF parser are valid
  const bounds = drawing.bounds;
  const isValidBounds = bounds && 
    isFinite(bounds.min.x) && isFinite(bounds.min.y) && 
    isFinite(bounds.max.x) && isFinite(bounds.max.y) &&
    bounds.min.x !== bounds.max.x && bounds.min.y !== bounds.max.y;
  
  if (isValidBounds) {
    // Use the bounding box that was already calculated by the DXF parser
    return {
      width: Math.abs(bounds.max.x - bounds.min.x),
      height: Math.abs(bounds.max.y - bounds.min.y),
      units: drawing.units,
      source: 'calculated'
    };
  }
  
  // If DXF bounds are invalid, calculate using OpenCascade.js
  console.warn('DXF bounds are invalid, falling back to OpenCascade.js calculation');
  
  // Initialize OpenCascade.js if not already loaded
  if (!openCascade) {
    try {
      const opencascadeModule = await import('opencascade.js');
      openCascade = await opencascadeModule.default();
    } catch (error) {
      console.error('Failed to load OpenCascade.js:', error);
      throw new Error('Cannot calculate drawing size: both DXF bounds and OpenCascade.js failed');
    }
  }

  const occBounds = await calculateBoundingBoxWithOCC(drawing.shapes);
  if (!occBounds) {
    throw new Error('Failed to calculate bounding box with OpenCascade.js');
  }

  return {
    width: occBounds.width,
    height: occBounds.height,
    units: drawing.units,
    source: 'calculated'
  };
}

async function calculateBoundingBoxWithOCC(shapes: Shape[]): Promise<{ width: number; height: number } | null> {
  if (!openCascade || shapes.length === 0) return null;

  try {
    // Create a compound shape from all individual shapes
    const builder = new openCascade.BRep_Builder();
    const compound = new openCascade.TopoDS_Compound();
    builder.MakeCompound(compound);

    let hasValidShapes = false;

    // Convert each shape to OpenCascade geometry and add to compound
    for (const shape of shapes) {
      const occShape = await convertShapeToOCC(shape);
      if (occShape) {
        builder.Add(compound, occShape);
        occShape.delete();
        hasValidShapes = true;
      }
    }

    if (!hasValidShapes) {
      compound.delete();
      builder.delete();
      return null;
    }

    // Calculate bounding box using OpenCascade.js
    const boundingBox = new openCascade.Bnd_Box_1();
    openCascade.BRepBndLib.Add(compound, boundingBox, false);

    // Extract bounds
    const corner1 = boundingBox.CornerMin();
    const corner2 = boundingBox.CornerMax();
    
    const width = Math.abs(corner2.X() - corner1.X());
    const height = Math.abs(corner2.Y() - corner1.Y());

    // Clean up
    compound.delete();
    boundingBox.delete();
    corner1.delete();
    corner2.delete();
    builder.delete();

    return { width, height };
  } catch (error) {
    console.error('Error in OpenCascade.js bounding box calculation:', error);
    return null;
  }
}

async function convertShapeToOCC(shape: Shape): Promise<any> {
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
        const lineGeom = new openCascade.GC_MakeSegment_1(p1, p2);
        const edge = new openCascade.BRepBuilderAPI_MakeEdge_24(lineGeom.Value().get());
        
        p1.delete();
        p2.delete();
        lineGeom.delete();
        
        return edge.Edge();

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
        
        return circleEdge.Edge();

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
        
        return arcEdge.Edge();

      case 'polyline':
        const polyline = shape.geometry as any;
        if (!polyline.points || polyline.points.length < 2) return null;

        // Validate all points are finite
        for (const point of polyline.points) {
          if (!point || !isFinite(point.x) || !isFinite(point.y)) {
            return null;
          }
        }

        const wireBuilder = new openCascade.BRepBuilderAPI_MakeWire_1();
        
        for (let i = 0; i < polyline.points.length - 1; i++) {
          const pt1 = new openCascade.gp_Pnt_3(polyline.points[i].x, polyline.points[i].y, 0);
          const pt2 = new openCascade.gp_Pnt_3(polyline.points[i + 1].x, polyline.points[i + 1].y, 0);
          const segment = new openCascade.GC_MakeSegment_1(pt1, pt2);
          const edge = new openCascade.BRepBuilderAPI_MakeEdge_24(segment.Value().get());
          
          wireBuilder.Add_1(edge.Edge());
          
          pt1.delete();
          pt2.delete();
          segment.delete();
          edge.delete();
        }

        // Close the wire if needed
        if (polyline.closed && polyline.points.length > 2) {
          const firstPt = new openCascade.gp_Pnt_3(polyline.points[polyline.points.length - 1].x, polyline.points[polyline.points.length - 1].y, 0);
          const lastPt = new openCascade.gp_Pnt_3(polyline.points[0].x, polyline.points[0].y, 0);
          const closingSegment = new openCascade.GC_MakeSegment_1(firstPt, lastPt);
          const closingEdge = new openCascade.BRepBuilderAPI_MakeEdge_24(closingSegment.Value().get());
          
          wireBuilder.Add_1(closingEdge.Edge());
          
          firstPt.delete();
          lastPt.delete();
          closingSegment.delete();
          closingEdge.delete();
        }

        return wireBuilder.Wire();

      default:
        return null;
    }
  } catch (error) {
    console.warn(`Error converting ${shape.type} to OpenCascade shape:`, error);
    return null;
  }
}