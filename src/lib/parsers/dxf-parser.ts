// Dynamic import to avoid SSR issues
let parseString: any;
import type { Drawing, Shape, Point2D } from '../../types';
import { generateId } from '../utils/id';

interface DXFOptions {
  squashLayers?: boolean;
  // Legacy options (ignored - algorithms moved to separate functions)
  decomposePolylines?: boolean;
  translateToPositiveQuadrant?: boolean;
}

/**
 * Helper function to conditionally include layer information based on squashLayers option
 */
function getLayerInfo(entity: any, options: DXFOptions): { layer?: string } {
  if (options.squashLayers) {
    return {}; // Don't include layer information
  }
  return { layer: entity.layer };
}

export async function parseDXF(content: string, options: DXFOptions = {}): Promise<Drawing> {
  // Dynamically import DXF parser only on client side
  if (!parseString) {
    const dxfModule = await import('dxf');
    parseString = dxfModule.parseString;
  }
  
  const parsed = parseString(content);
  const shapes: Shape[] = [];
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };

  // Extract units from DXF header
  let drawingUnits: 'mm' | 'inch' = 'mm'; // Default to mm
  
  
  if (parsed && parsed.header && (parsed.header.$INSUNITS !== undefined || parsed.header.insUnits !== undefined)) {
    const insunits = parsed.header.$INSUNITS || parsed.header.insUnits;
    // Convert DXF $INSUNITS values to our unit system
    switch (insunits) {
      case 1: // Inches
        drawingUnits = 'inch';
        break;
      case 4: // Millimeters  
        drawingUnits = 'mm';
        break;
      case 5: // Centimeters - treat as mm for now
        drawingUnits = 'mm';
        break;
      case 6: // Meters - treat as mm for now
        drawingUnits = 'mm';
        break;
      default:
        // For all other units (unitless, feet, etc.), default to mm
        drawingUnits = 'mm';
        break;
    }
  }

  // Process blocks first to build block dictionary
  const blocks = new Map<string, any[]>();
  const blockBasePoints = new Map<string, {x: number, y: number}>();
  if (parsed && parsed.blocks) {
    for (const blockKey in parsed.blocks) {
      const block = parsed.blocks[blockKey];
      if (block && block.entities && block.name) {
        blocks.set(block.name, block.entities);
        // Store block base point for INSERT transformations
        blockBasePoints.set(block.name, {
          x: block.x || 0,
          y: block.y || 0
        });
      }
    }
  }

  // Process entities
  if (parsed && parsed.entities) {
    parsed.entities.forEach((entity: any) => {
      const result = convertDXFEntity(entity, options, blocks, blockBasePoints);
      if (result) {
        if (Array.isArray(result)) {
          // Multiple shapes (decomposed polyline or INSERT entities)
          result.forEach(shape => {
            shapes.push(shape);
            updateBounds(shape, bounds);
          });
        } else {
          // Single shape
          shapes.push(result);
          updateBounds(result, bounds);
        }
      }
    });
  }

  // Ensure bounds are valid - if no shapes were processed, set to zero bounds
  let finalBounds = {
    min: { 
      x: isFinite(bounds.minX) ? bounds.minX : 0, 
      y: isFinite(bounds.minY) ? bounds.minY : 0 
    },
    max: { 
      x: isFinite(bounds.maxX) ? bounds.maxX : 0, 
      y: isFinite(bounds.maxY) ? bounds.maxY : 0 
    }
  };


  return {
    shapes,
    bounds: finalBounds, 
    units: drawingUnits // Use detected units from DXF header
  };
}


function convertDXFEntity(entity: any, options: DXFOptions = {}, blocks: Map<string, any[]> = new Map(), blockBasePoints: Map<string, {x: number, y: number}> = new Map()): Shape | Shape[] | null {
  try {
    switch (entity.type) {
      case 'INSERT':
        // Handle INSERT entities (block references)
        const blockName = entity.block || entity.name;
        if (blockName && blocks.has(blockName)) {
          const blockEntities = blocks.get(blockName) || [];
          const insertedShapes: Shape[] = [];
          
          // Get transformation parameters with defaults
          const insertX = entity.x || 0;
          const insertY = entity.y || 0;
          const scaleX = entity.scaleX || 1;
          const scaleY = entity.scaleY || 1;
          const rotation = entity.rotation || 0; // In degrees
          const rotationRad = (rotation * Math.PI) / 180; // Convert to radians
          
          // Get block base point for proper INSERT positioning
          const basePoint = blockBasePoints.get(blockName) || { x: 0, y: 0 };
          
          // Process each entity in the block
          for (const blockEntity of blockEntities) {
            const shape = convertDXFEntity(blockEntity, options, blocks, blockBasePoints);
            if (shape) {
              const shapesToTransform = Array.isArray(shape) ? shape : [shape];
              
              // Apply transformation to each shape
              for (const shapeToTransform of shapesToTransform) {
                const transformedShape = transformShape(shapeToTransform, {
                  insertX,
                  insertY,
                  scaleX,
                  scaleY,
                  rotationRad,
                  blockBaseX: basePoint.x,
                  blockBaseY: basePoint.y
                });
                if (transformedShape) {
                  insertedShapes.push(transformedShape);
                }
              }
            }
          }
          
          return insertedShapes.length > 0 ? insertedShapes : null;
        }
        return null;

      case 'LINE':
        // Handle LINE entities - can have vertices array or direct start/end points
        if (entity.vertices && entity.vertices.length >= 2) {
          return {
            id: generateId(),
            type: 'line',
            geometry: {
              start: { x: entity.vertices[0].x, y: entity.vertices[0].y },
              end: { x: entity.vertices[1].x, y: entity.vertices[1].y }
            },
            ...getLayerInfo(entity, options)
          };
        } else if (entity.start && entity.end) {
          // Alternative LINE format
          return {
            id: generateId(),
            type: 'line',
            geometry: {
              start: { x: entity.start.x, y: entity.start.y },
              end: { x: entity.end.x, y: entity.end.y }
            },
            ...getLayerInfo(entity, options)
          };
        }
        return null;

      case 'CIRCLE':
        // CIRCLE entities have x, y, r properties (similar to ARCs)
        if (typeof entity.x === 'number' && typeof entity.y === 'number' && typeof entity.r === 'number') {
          return {
            id: generateId(),
            type: 'circle',
            geometry: {
              center: { x: entity.x, y: entity.y },
              radius: entity.r
            },
            ...getLayerInfo(entity, options)
          };
        }
        return null;

      case 'ARC':
        // ARC entities have x, y, r properties (not center/radius)
        if (typeof entity.x === 'number' && typeof entity.y === 'number' && 
            typeof entity.r === 'number' && typeof entity.startAngle === 'number' && 
            typeof entity.endAngle === 'number') {
          return {
            id: generateId(),
            type: 'arc',
            geometry: {
              center: { x: entity.x, y: entity.y },
              radius: entity.r,
              startAngle: entity.startAngle, // Already in radians from DXF library
              endAngle: entity.endAngle,     // Already in radians from DXF library
              clockwise: false
            },
            ...getLayerInfo(entity, options)
          };
        }
        return null;

      case 'SPLINE':
        // SPLINE entities are NURBS curves - convert to polyline by sampling points
        if (entity.controlPoints && Array.isArray(entity.controlPoints) && entity.controlPoints.length >= 2) {
          try {
            const sampledPoints = sampleSplinePoints(entity);
            if (sampledPoints.length >= 2) {
              return {
                id: generateId(),
                type: 'polyline',
                geometry: {
                  points: sampledPoints,
                  closed: entity.closed || false
                },
                ...getLayerInfo(entity, options),
                originalType: 'spline', // Keep track of original entity type
                splineData: {
                  controlPoints: entity.controlPoints || [],
                  knots: entity.knots || [],
                  weights: entity.weights || [],
                  degree: entity.degree || 3,
                  fitPoints: entity.fitPoints || []
                }
              };
            }
          } catch (error) {
            console.warn('Error sampling SPLINE entity:', error);
            return null;
          }
        }
        return null;

      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (entity.vertices && Array.isArray(entity.vertices) && entity.vertices.length > 0) {
          // Return as polyline and preserve bulge data
          const vertices = entity.vertices
            .filter((v: any) => v && typeof v.x === 'number' && typeof v.y === 'number')
            .map((v: any) => ({
              x: v.x,
              y: v.y,
              bulge: v.bulge || 0
            }));
          
          if (vertices.length > 0) {
            return {
              id: generateId(),
              type: 'polyline',
              geometry: {
                points: vertices.map((v: any) => ({ x: v.x, y: v.y })), // Keep existing interface
                closed: entity.shape || entity.closed || false,
                vertices // Add bulge-aware vertices
              },
              ...getLayerInfo(entity, options)
            };
          }
        }
        return null;

      case 'ELLIPSE':
        // Handle ELLIPSE entities
        // DXF ellipse format:
        // 10, 20, 30: Center point (x, y, z)
        // 11, 21, 31: Major axis endpoint vector (x, y, z)
        // 40: Ratio of minor axis to major axis
        // 41: Start parameter (for ellipse arcs) - optional
        // 42: End parameter (for ellipse arcs) - optional
        if (typeof entity.x === 'number' && typeof entity.y === 'number' &&
            typeof entity.majorX === 'number' && typeof entity.majorY === 'number' &&
            typeof entity.axisRatio === 'number') {
          
          const ellipse: any = {
            center: { x: entity.x, y: entity.y },
            majorAxisEndpoint: { x: entity.majorX, y: entity.majorY },
            minorToMajorRatio: entity.axisRatio
          };
          
          // Add start and end parameters if they exist (ellipse arcs)
          // Note: DXF uses startAngle/endAngle but we use startParam/endParam internally
          if (typeof entity.startAngle === 'number') {
            ellipse.startParam = entity.startAngle;
          }
          if (typeof entity.endAngle === 'number') {
            ellipse.endParam = entity.endAngle;
          }
          
          return {
            id: generateId(),
            type: 'ellipse',
            geometry: ellipse,
            ...getLayerInfo(entity, options)
          };
        }
        return null;

      default:
        // Silently ignore unknown entity types
        return null;
    }
  } catch (error) {
    // Log the error for debugging but don't crash the parsing
    console.warn(`Error converting DXF entity of type ${entity.type}:`, error);
    return null;
  }
}


function updateBounds(shape: Shape, bounds: any): void {
  const points = getShapePoints(shape);
  points.forEach(p => {
    // Only update bounds with finite values
    if (p && isFinite(p.x) && isFinite(p.y)) {
      bounds.minX = Math.min(bounds.minX, p.x);
      bounds.minY = Math.min(bounds.minY, p.y);
      bounds.maxX = Math.max(bounds.maxX, p.x);
      bounds.maxY = Math.max(bounds.maxY, p.y);
    }
  });
}

// Sample points along a SPLINE (NURBS) curve to convert to polyline
function sampleSplinePoints(splineEntity: any): Point2D[] {
  const controlPoints = splineEntity.controlPoints;
  const degree = splineEntity.degree || 3;
  // const knots = splineEntity.knots; // Reserved for future NURBS implementation
  
  // Simple approach: if we have fit points, use them
  if (splineEntity.fitPoints && splineEntity.fitPoints.length >= 2) {
    return splineEntity.fitPoints.map((p: any) => ({ x: p.x, y: p.y }));
  }
  
  // For now, implement a simple approach using control points
  // For production use, we'd want proper NURBS evaluation
  const sampledPoints: Point2D[] = [];
  const numSamples = Math.max(16, controlPoints.length * 4); // Adaptive sampling
  
  if (degree === 1 || controlPoints.length <= 2) {
    // Linear interpolation for degree 1 or simple cases
    for (let i = 0; i < controlPoints.length; i++) {
      sampledPoints.push({ x: controlPoints[i].x, y: controlPoints[i].y });
    }
  } else {
    // Simple approximation: sample along the control polygon with smoothing
    // This is not a true NURBS evaluation but provides a reasonable approximation
    
    // Start with first control point
    sampledPoints.push({ x: controlPoints[0].x, y: controlPoints[0].y });
    
    // Sample intermediate points using a simple curve approximation
    for (let i = 0; i < numSamples - 1; i++) {
      const t = (i + 1) / numSamples;
      const point = evaluateSimpleBSpline(controlPoints, degree, t);
      if (point) {
        sampledPoints.push(point);
      }
    }
    
    // End with last control point
    const lastPoint = controlPoints[controlPoints.length - 1];
    sampledPoints.push({ x: lastPoint.x, y: lastPoint.y });
  }
  
  return sampledPoints;
}

// Simple B-spline evaluation (approximation)
function evaluateSimpleBSpline(controlPoints: any[], degree: number, t: number): Point2D | null {
  if (controlPoints.length === 0) return null;
  
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));
  
  if (degree === 1 || controlPoints.length <= 2) {
    // Linear interpolation
    const index = t * (controlPoints.length - 1);
    const i = Math.floor(index);
    const j = Math.min(i + 1, controlPoints.length - 1);
    const alpha = index - i;
    
    return {
      x: controlPoints[i].x * (1 - alpha) + controlPoints[j].x * alpha,
      y: controlPoints[i].y * (1 - alpha) + controlPoints[j].y * alpha
    };
  }
  
  // For higher degrees, use a simple approximation
  // This is not true NURBS evaluation but works for basic cases
  const n = controlPoints.length - 1;
  let x = 0, y = 0;
  
  for (let i = 0; i <= n; i++) {
    const basis = bernsteinBasis(n, i, t);
    x += basis * controlPoints[i].x;
    y += basis * controlPoints[i].y;
  }
  
  return { x, y };
}

// Bernstein basis function (for Bezier curve approximation)
function bernsteinBasis(n: number, i: number, t: number): number {
  return binomialCoefficient(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i);
}

// Binomial coefficient calculation
function binomialCoefficient(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return result;
}

function transformShape(shape: Shape, transform: {
  insertX: number;
  insertY: number;
  scaleX: number;
  scaleY: number;
  rotationRad: number;
  blockBaseX: number;
  blockBaseY: number;
}): Shape | null {
  const { insertX, insertY, scaleX, scaleY, rotationRad, blockBaseX, blockBaseY } = transform;
  const clonedShape = JSON.parse(JSON.stringify(shape));
  
  const transformPoint = (p: Point2D): Point2D => {
    // Step 1: Translate by negative block base point (block origin)
    let x = p.x - blockBaseX;
    let y = p.y - blockBaseY;
    
    // Step 2: Apply scaling
    x = x * scaleX;
    y = y * scaleY;
    
    // Step 3: Apply rotation
    if (rotationRad !== 0) {
      const cos = Math.cos(rotationRad);
      const sin = Math.sin(rotationRad);
      const newX = x * cos - y * sin;
      const newY = x * sin + y * cos;
      x = newX;
      y = newY;
    }
    
    // Step 4: Apply INSERT position translation
    x += insertX;
    y += insertY;
    
    return { x, y };
  };
  
  // Transform geometry based on shape type
  switch (clonedShape.type) {
    case 'line':
      const line = clonedShape.geometry as any;
      line.start = transformPoint(line.start);
      line.end = transformPoint(line.end);
      break;
      
    case 'circle':
    case 'arc':
      const circle = clonedShape.geometry as any;
      circle.center = transformPoint(circle.center);
      // Scale radius (use average of scaleX and scaleY for uniform scaling)
      circle.radius *= (scaleX + scaleY) / 2;
      // Adjust arc angles for rotation
      if (clonedShape.type === 'arc' && rotationRad !== 0) {
        circle.startAngle += rotationRad;
        circle.endAngle += rotationRad;
      }
      break;
      
    case 'polyline':
      const polyline = clonedShape.geometry as any;
      polyline.points = polyline.points.map(transformPoint);
      if (polyline.vertices) {
        polyline.vertices = polyline.vertices.map((v: any) => ({
          ...v,
          ...transformPoint({ x: v.x, y: v.y })
        }));
      }
      break;
      
    case 'ellipse':
      const ellipse = clonedShape.geometry as any;
      ellipse.center = transformPoint(ellipse.center);
      // Transform the major axis endpoint vector
      const majorAxisEnd = {
        x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
        y: ellipse.center.y + ellipse.majorAxisEndpoint.y
      };
      const transformedMajorAxisEnd = transformPoint(majorAxisEnd);
      ellipse.majorAxisEndpoint = {
        x: transformedMajorAxisEnd.x - ellipse.center.x,
        y: transformedMajorAxisEnd.y - ellipse.center.y
      };
      // Note: minorToMajorRatio stays the same as it's a proportion
      break;
      
    default:
      console.warn(`Unknown shape type for transformation: ${clonedShape.type}`);
      return null;
  }
  
  // Generate new ID for transformed shape
  clonedShape.id = generateId();
  
  return clonedShape;
}

function getShapePoints(shape: Shape): Point2D[] {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return [line.start, line.end];
    
    case 'circle':
      const circle = shape.geometry as any;
      return [
        { x: circle.center.x - circle.radius, y: circle.center.y - circle.radius },
        { x: circle.center.x + circle.radius, y: circle.center.y + circle.radius }
      ];
    
    case 'arc':
      const arc = shape.geometry as any;
      return [
        { x: arc.center.x - arc.radius, y: arc.center.y - arc.radius },
        { x: arc.center.x + arc.radius, y: arc.center.y + arc.radius }
      ];
    
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points;
    
    case 'ellipse':
      const ellipse = shape.geometry as any;
      // Calculate bounding box points for ellipse
      const majorAxisLength = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
        ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
      );
      const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
      
      // For bounding box calculation, we need the extent of the ellipse
      // This is an approximation - true ellipse bounds calculation is more complex
      const maxExtent = Math.max(majorAxisLength, minorAxisLength);
      
      return [
        { x: ellipse.center.x - maxExtent, y: ellipse.center.y - maxExtent },
        { x: ellipse.center.x + maxExtent, y: ellipse.center.y + maxExtent }
      ];
    
    default:
      return [];
  }
}