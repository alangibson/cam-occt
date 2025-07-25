/**
 * Correct tessellation implementation for shapes
 * Based on MetalHeadCAM reference implementation
 */

import type { Shape, Point2D } from '../../types';
import type { PartDetectionParameters } from '../../types/part-detection';

export function tessellateShape(shape: Shape, params: PartDetectionParameters): Point2D[] {
  const points: Point2D[] = [];
  
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      points.push(line.start, line.end);
      break;
      
    case 'circle':
      const circle = shape.geometry as any;
      const numPoints = params.circleTessellationPoints;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        points.push({
          x: circle.center.x + circle.radius * Math.cos(angle),
          y: circle.center.y + circle.radius * Math.sin(angle)
        });
      }
      break;
      
    case 'arc':
      const arc = shape.geometry as any;
      
      // Calculate the angular difference (sweep)
      let deltaAngle = arc.endAngle - arc.startAngle;
      
      // Adjust deltaAngle based on clockwise flag
      // DXF arcs are counterclockwise by default unless clockwise flag is set
      if (arc.clockwise) {
        // For clockwise arcs, if deltaAngle > 0, we want the long way around
        if (deltaAngle > 0) {
          deltaAngle -= 2 * Math.PI;
        }
      } else {
        // For counterclockwise arcs, if deltaAngle < 0, we want to cross zero
        if (deltaAngle < 0) {
          deltaAngle += 2 * Math.PI;
        }
      }
      
      const arcSpan = Math.abs(deltaAngle);
      const numArcPoints = Math.max(params.minArcTessellationPoints, Math.round(arcSpan / params.arcTessellationDensity));
      
      for (let i = 0; i <= numArcPoints; i++) {
        const t = i / numArcPoints;
        // Calculate angle using the corrected deltaAngle
        const theta = arc.startAngle + t * deltaAngle;
        points.push({
          x: arc.center.x + arc.radius * Math.cos(theta),
          y: arc.center.y + arc.radius * Math.sin(theta)
        });
      }
      break;
      
    case 'polyline':
      const polyline = shape.geometry as any;
      if (polyline.vertices && polyline.vertices.length > 0) {
        polyline.vertices.forEach((vertex: any) => {
          points.push({ x: vertex.x, y: vertex.y });
        });
      } else if (polyline.points && polyline.points.length > 0) {
        points.push(...polyline.points);
      }
      break;
      
    case 'ellipse':
      const ellipse = shape.geometry as any;
      const majorAxisLength = Math.sqrt(
        ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
        ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
      );
      const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
      const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
      
      const isArc = typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number';
      
      if (isArc) {
        // Ellipse arc - use similar logic to circular arcs
        let deltaParam = ellipse.endParam - ellipse.startParam;
        
        // For ellipses, we assume counterclockwise by default
        if (deltaParam < 0) {
          deltaParam += 2 * Math.PI;
        }
        
        const paramSpan = Math.abs(deltaParam);
        const numEllipsePoints = Math.max(8, Math.round(paramSpan / (Math.PI / 16)));
        
        for (let i = 0; i <= numEllipsePoints; i++) {
          const t = i / numEllipsePoints;
          const param = ellipse.startParam + t * deltaParam;
          
          const x = majorAxisLength * Math.cos(param);
          const y = minorAxisLength * Math.sin(param);
          
          const rotatedX = x * Math.cos(majorAxisAngle) - y * Math.sin(majorAxisAngle);
          const rotatedY = x * Math.sin(majorAxisAngle) + y * Math.cos(majorAxisAngle);
          
          points.push({
            x: ellipse.center.x + rotatedX,
            y: ellipse.center.y + rotatedY
          });
        }
      } else {
        // Full ellipse
        const numEllipsePoints = 32;
        for (let i = 0; i < numEllipsePoints; i++) {
          const param = (i / numEllipsePoints) * 2 * Math.PI;
          
          const x = majorAxisLength * Math.cos(param);
          const y = minorAxisLength * Math.sin(param);
          
          const rotatedX = x * Math.cos(majorAxisAngle) - y * Math.sin(majorAxisAngle);
          const rotatedY = x * Math.sin(majorAxisAngle) + y * Math.cos(majorAxisAngle);
          
          points.push({
            x: ellipse.center.x + rotatedX,
            y: ellipse.center.y + rotatedY
          });
        }
      }
      break;
  }
  
  return points;
}