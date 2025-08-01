import type { Point2D } from '../../types/geometry';
import type { ShapeChain } from './chain-detection';
import type { DetectedPart } from './part-detection';
import { LeadType, CutDirection } from '../types/direction';
import { validateLeadConfiguration, type LeadValidationResult } from './lead-validation';

export interface LeadInConfig {
  type: LeadType;
  length: number; // For arc: length along the arc
  flipSide?: boolean; // Flip which side of the chain the lead is on
  angle?: number; // Manual rotation angle (degrees, 0-360). If undefined, auto-calculated
}

export interface LeadOutConfig {
  type: LeadType;
  length: number; // For arc: length along the arc
  flipSide?: boolean; // Flip which side of the chain the lead is on
  angle?: number; // Manual rotation angle (degrees, 0-360). If undefined, auto-calculated
}

export interface LeadGeometry {
  points: Point2D[];
  type: LeadType;
}

export interface LeadResult {
  leadIn?: LeadGeometry;
  leadOut?: LeadGeometry;
  warnings?: string[];
  validation?: LeadValidationResult;
}

/**
 * Calculate lead-in and lead-out geometry for a chain.
 * Leads must be placed appropriately based on the context (inside holes, outside shells).
 * Lead direction respects the cut direction for proper tangency.
 */
export function calculateLeads(
  chain: ShapeChain,
  leadInConfig: LeadInConfig,
  leadOutConfig: LeadOutConfig,
  cutDirection: CutDirection = CutDirection.NONE,
  part?: DetectedPart
): LeadResult {
  const result: LeadResult = {};
  const warnings: string[] = [];

  // 1. VALIDATION PIPELINE - Run comprehensive validation first
  const validation = validateLeadConfiguration(
    { leadIn: leadInConfig, leadOut: leadOutConfig, cutDirection },
    chain,
    part
  );
  
  result.validation = validation;
  
  // Add validation warnings to the result
  if (validation.warnings.length > 0) {
    warnings.push(...validation.warnings);
  }
  
  // If validation fails with errors, return early with validation results
  if (!validation.isValid && validation.severity === 'error') {
    result.warnings = warnings;
    return result;
  }

  // Skip if no leads requested
  if (leadInConfig.type === 'none' && leadOutConfig.type === 'none') {
    return result;
  }

  // Determine if chain is a hole or shell
  const isHole = part ? part.holes.some((h: any) => h.chain.id === chain.id) : false;
  const isShell = part ? part.shell.chain.id === chain.id : false;

  // Get chain start and end points
  const startPoint = getChainStartPoint(chain);
  const endPoint = getChainEndPoint(chain);

  if (!startPoint || !endPoint) {
    return result;
  }

  // Calculate lead-in
  if (leadInConfig.type !== 'none' && leadInConfig.length > 0) {
    result.leadIn = calculateLead(
      chain,
      startPoint,
      leadInConfig,
      true,
      isHole,
      isShell,
      cutDirection,
      part,
      warnings
    );
  }

  // Calculate lead-out
  if (leadOutConfig.type !== 'none' && leadOutConfig.length > 0) {
    result.leadOut = calculateLead(
      chain,
      endPoint,
      leadOutConfig,
      false,
      isHole,
      isShell,
      cutDirection,
      part,
      warnings
    );
  }

  // Add warnings to result if any were generated
  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/**
 * Calculate a single lead (in or out).
 */
function calculateLead(
  chain: ShapeChain,
  point: Point2D,
  config: LeadInConfig | LeadOutConfig,
  isLeadIn: boolean,
  isHole: boolean,
  isShell: boolean,
  cutDirection: CutDirection,
  part?: DetectedPart,
  warnings: string[] = []
): LeadGeometry | undefined {
  if (config.type === LeadType.ARC) {
    return calculateArcLead(chain, point, config.length, isLeadIn, isHole, isShell, cutDirection, part, warnings, config.flipSide, config.angle);
  } else if (config.type === LeadType.LINE) {
    return calculateLineLead(chain, point, config.length, isLeadIn, isHole, isShell, cutDirection, part, warnings, config.flipSide, config.angle);
  }
  return undefined;
}

/**
 * Calculate an arc lead that is tangent to the chain at the connection point.
 * Arc sweep is limited to 90 degrees maximum.
 * Lead direction depends on cut direction, hole vs shell context.
 * If the lead intersects solid areas of the part, rotate it in 5-degree increments to find a clear path.
 * If no clear path is found after 360 degrees of rotation, adds a warning.
 */
function calculateArcLead(
  chain: ShapeChain,
  point: Point2D,
  arcLength: number,
  isLeadIn: boolean,
  isHole: boolean,
  isShell: boolean,
  cutDirection: CutDirection,
  part?: DetectedPart,
  warnings: string[] = [],
  flipSide: boolean = false,
  manualAngle?: number
): LeadGeometry {
  
  // Get the tangent direction at the point
  const tangent = getChainTangent(chain, point, isLeadIn);
  
  // Calculate the base normal direction considering cut direction
  const baseCurveDirection = getLeadCurveDirection(tangent, isHole, isShell, cutDirection, chain, point, part, arcLength, flipSide);

  // Calculate arc parameters with 90-degree maximum sweep
  const maxSweepAngle = Math.PI / 2; // 90 degrees
  
  // For a given arc length and maximum sweep, calculate minimum radius
  const minRadius = arcLength / maxSweepAngle;
  
  // Use the minimum radius and adjust sweep angle to get exact arc length
  const radius = minRadius;
  const sweepAngle = arcLength / radius; // This will be <= 90 degrees
  
  // Ensure we don't exceed 90 degrees
  const actualSweepAngle = Math.min(sweepAngle, maxSweepAngle);
  
  // Determine curve direction strategy: manual absolute angle or automatic optimization
  let curveDirectionsToTry: { x: number; y: number }[];
  
  if (manualAngle !== undefined) {
    // Use manual angle as absolute direction (unit circle: 0° = right, 90° = up, etc.)
    // Work in world coordinates (Y+ up), canvas rendering will handle coordinate conversion
    const manualAngleRad = (manualAngle * Math.PI) / 180;
    const absoluteDirection = {
      x: Math.cos(manualAngleRad),
      y: Math.sin(manualAngleRad)  // Use standard unit circle (Y+ up for world coordinates)
    };
    curveDirectionsToTry = [absoluteDirection];
  } else {
    // Try different curve directions up to 360 degrees to avoid solid areas
    const rotationStep = 5 * Math.PI / 180; // 5 degrees in radians
    const maxRotations = 72; // Try up to 360 degrees of rotation (72 * 5 = 360)
    curveDirectionsToTry = Array.from({ length: maxRotations }, (_, i) => {
      const rotationAngle = i * rotationStep;
      return rotateCurveDirection(baseCurveDirection, rotationAngle);
    });
  }
  
  // Try full length first, then shorter lengths if needed
  const lengthAttempts = [1.0, 0.75, 0.5, 0.25]; // Try 100%, 75%, 50%, 25% of original length
  
  for (const lengthFactor of lengthAttempts) {
    const adjustedArcLength = arcLength * lengthFactor;
    const adjustedRadius = adjustedArcLength / maxSweepAngle;
    const adjustedSweepAngle = Math.min(adjustedArcLength / adjustedRadius, maxSweepAngle);
    
    for (const curveDirection of curveDirectionsToTry) {
      
      // Calculate arc center position for perfect tangency
      const arcCenter: Point2D = {
        x: point.x + curveDirection.x * adjustedRadius,
        y: point.y + curveDirection.y * adjustedRadius
      };

      // Generate arc points ensuring tangency
      let points: Point2D[];
      if (manualAngle !== undefined) {
        // For manual angles, use simpler arc generation that respects the angle
        points = generateSimpleArcPoints(
          arcCenter,
          adjustedRadius,
          point,
          adjustedSweepAngle,
          isLeadIn,
          curveDirection
        );
      } else {
        points = generateTangentArcPoints(
          arcCenter,
          adjustedRadius,
          point,
          adjustedSweepAngle,
          isLeadIn,
          tangent,
          curveDirection
        );
      }

      // If no part context, use the first valid lead
      if (!part) {
        return {
          points,
          type: LeadType.ARC
        };
      }

      // Check if this lead avoids solid areas using proper point-in-polygon detection
      const solidPointCount = countSolidAreaPoints(points, part, point);
      const intersectsSolid = solidPointCount > 0;
      
      if (!intersectsSolid) {
        return {
          points,
          type: LeadType.ARC
        };
      }
    }
    
  }

  // If no rotation avoids solid areas after trying all angles and lengths, add a warning
  if (part) {
    const leadType = isLeadIn ? 'Lead-in' : 'Lead-out';
    const shapeType = isHole ? 'hole' : (isShell ? 'shell' : 'shape');
    warnings.push(`${leadType} for ${shapeType} intersects solid material and cannot be avoided. Consider reducing lead length or manually adjusting the path.`);
  }

  // Return the base direction as fallback
  const arcCenter: Point2D = {
    x: point.x + baseCurveDirection.x * radius,
    y: point.y + baseCurveDirection.y * radius
  };

  let points: Point2D[];
  if (manualAngle !== undefined) {
    // For manual angles, use simpler arc generation that respects the angle
    points = generateSimpleArcPoints(
      arcCenter,
      radius,
      point,
      actualSweepAngle,
      isLeadIn,
      baseCurveDirection
    );
  } else {
    points = generateTangentArcPoints(
      arcCenter,
      radius,
      point,
      actualSweepAngle,
      isLeadIn,
      tangent,
      baseCurveDirection
    );
  }

  return {
    points,
    type: LeadType.ARC
  };
}

/**
 * Calculate a straight line lead that is tangent to the chain at the connection point.
 * Line direction depends on cut direction, hole vs shell context.
 * If the lead intersects solid areas of the part, rotate it in 5-degree increments to find a clear path.
 * If no clear path is found after 360 degrees of rotation, adds a warning.
 */
function calculateLineLead(
  chain: ShapeChain,
  point: Point2D,
  lineLength: number,
  isLeadIn: boolean,
  isHole: boolean,
  isShell: boolean,
  cutDirection: CutDirection,
  part?: DetectedPart,
  warnings: string[] = [],
  flipSide: boolean = false,
  manualAngle?: number
): LeadGeometry {
  
  // Get the tangent direction at the point
  const tangent = getChainTangent(chain, point, isLeadIn);
  
  // Calculate the base normal direction considering cut direction
  const baseLeadDirection = getLeadCurveDirection(tangent, isHole, isShell, cutDirection, chain, point, part, lineLength, flipSide);
  
  // Determine lead direction strategy: manual absolute angle or automatic optimization
  let leadDirectionsToTry: { x: number; y: number }[];
  
  if (manualAngle !== undefined) {
    // Use manual angle as absolute direction (unit circle: 0° = right, 90° = up, etc.)
    // Work in world coordinates (Y+ up), canvas rendering will handle coordinate conversion
    const manualAngleRad = (manualAngle * Math.PI) / 180;
    const absoluteDirection = {
      x: Math.cos(manualAngleRad),
      y: Math.sin(manualAngleRad)  // Use standard unit circle (Y+ up for world coordinates)
    };
    leadDirectionsToTry = [absoluteDirection];
  } else {
    // Try different lead directions up to 360 degrees to avoid solid areas
    const rotationStep = 5 * Math.PI / 180; // 5 degrees in radians
    const maxRotations = 72; // Try up to 360 degrees of rotation (72 * 5 = 360)
    leadDirectionsToTry = Array.from({ length: maxRotations }, (_, i) => {
      const rotationAngle = i * rotationStep;
      return rotateCurveDirection(baseLeadDirection, rotationAngle);
    });
  }
  
  // Try full length first, then shorter lengths if needed
  const lengthAttempts = [1.0, 0.75, 0.5, 0.25]; // Try 100%, 75%, 50%, 25% of original length
  
  for (const lengthFactor of lengthAttempts) {
    const adjustedLineLength = lineLength * lengthFactor;
    
    for (const leadDirection of leadDirectionsToTry) {
      
      // Generate line points
      const points = generateTangentLinePoints(
        point,
        adjustedLineLength,
        isLeadIn,
        tangent,
        leadDirection
      );

      // If no part context, use the first valid lead
      if (!part) {
        return {
          points,
          type: LeadType.LINE
        };
      }

      // Check if this lead avoids solid areas using proper point-in-polygon detection
      const solidPointCount = countSolidAreaPoints(points, part, point);
      const intersectsSolid = solidPointCount > 0;
      
      if (!intersectsSolid) {
        return {
          points,
          type: LeadType.LINE
        };
      }
    }
  }

  // If no rotation avoids solid areas after trying all angles and lengths, add a warning
  if (part) {
    const leadType = isLeadIn ? 'Lead-in' : 'Lead-out';
    const shapeType = isHole ? 'hole' : (isShell ? 'shell' : 'shape');
    warnings.push(`${leadType} for ${shapeType} intersects solid material and cannot be avoided. Consider reducing lead length or manually adjusting the path.`);
  }

  // Return the base direction as fallback
  const points = generateTangentLinePoints(
    point,
    lineLength,
    isLeadIn,
    tangent,
    baseLeadDirection
  );

  return {
    points,
    type: LeadType.LINE
  };
}

/**
 * Generate points along a simple arc lead that respects manual angles.
 * This is used when manual angles are specified to avoid complex tangency calculations.
 */
function generateSimpleArcPoints(
  center: Point2D,
  radius: number,
  connectionPoint: Point2D,
  sweepAngle: number,
  isLeadIn: boolean,
  direction: Point2D
): Point2D[] {
  const points: Point2D[] = [];
  const segments = Math.max(8, Math.ceil(sweepAngle * radius / 2)); // Approximate 2mm segments

  // Calculate the angle of the connection point relative to the arc center
  const connectionAngle = Math.atan2(
    connectionPoint.y - center.y, 
    connectionPoint.x - center.x
  );

  if (isLeadIn) {
    // Lead-in: arc starts away from connection and ends at connection point
    const startAngle = connectionAngle - sweepAngle; // Start earlier in the arc
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = startAngle + t * sweepAngle; // Sweep from start to connection
      
      if (i === segments) {
        // Ensure last point is exactly the connection point
        points.push(connectionPoint);
      } else {
        points.push({
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle)
        });
      }
    }
  } else {
    // Lead-out: arc starts at connection point and curves away
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = connectionAngle + t * sweepAngle; // Sweep from connection outward
      
      if (i === 0) {
        // Ensure first point is exactly the connection point
        points.push(connectionPoint);
      } else {
        points.push({
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle)
        });
      }
    }
  }

  return points;
}

/**
 * Generate points along a tangent arc lead.
 * The arc starts tangent to the chain and curves in the specified direction.
 */
function generateTangentArcPoints(
  center: Point2D,
  radius: number,
  connectionPoint: Point2D,
  sweepAngle: number,
  isLeadIn: boolean,
  tangent: Point2D,
  curveDirection: Point2D
): Point2D[] {
  const points: Point2D[] = [];
  const segments = Math.max(8, Math.ceil(sweepAngle * radius / 2)); // Approximate 2mm segments

  // Calculate the angle of the connection point relative to the arc center
  const connectionAngle = Math.atan2(
    connectionPoint.y - center.y, 
    connectionPoint.x - center.x
  );

  // For a truly tangent arc, we need to ensure the tangent direction at the connection point
  // matches the chain tangent. The tangent to a circle at any point is perpendicular to the
  // radius at that point.
  
  // Calculate what the tangent angle should be at the connection point
  const tangentAngle = Math.atan2(tangent.y, tangent.x);
  
  // The radius angle at the connection point should be perpendicular to the tangent
  // So radius angle = tangent angle ± 90°
  const radiusAngle1 = tangentAngle + Math.PI / 2;
  const radiusAngle2 = tangentAngle - Math.PI / 2;
  
  // Choose the radius angle that points from connection point toward the calculated center
  const actualRadiusAngle = Math.atan2(center.y - connectionPoint.y, center.x - connectionPoint.x);
  
  // Determine which radius angle is closer to the actual one
  const diff1 = Math.abs(normalizeAngle(radiusAngle1 - actualRadiusAngle));
  const diff2 = Math.abs(normalizeAngle(radiusAngle2 - actualRadiusAngle));
  const correctRadiusAngle = diff1 < diff2 ? radiusAngle1 : radiusAngle2;
  
  // Adjust the arc center to ensure perfect tangency
  const adjustedCenter: Point2D = {
    x: connectionPoint.x + radius * Math.cos(correctRadiusAngle),
    y: connectionPoint.y + radius * Math.sin(correctRadiusAngle)
  };

  // Determine sweep direction based on the curve direction relative to tangent
  // Cross product: tangent × curveDirection. If positive, curveDirection is to the left of tangent
  const crossProduct = tangent.x * curveDirection.y - tangent.y * curveDirection.x;
  const sweepCounterClockwise = crossProduct > 0;

  // For perfect tangency, the connection point angle relative to the adjusted center
  const connectionAngleFromAdjustedCenter = Math.atan2(
    connectionPoint.y - adjustedCenter.y,
    connectionPoint.x - adjustedCenter.x
  );

  // Generate arc points using the adjusted center
  if (isLeadIn) {
    // Lead-in: arc starts away from connection and ends at connection point
    const startAngle = sweepCounterClockwise 
      ? connectionAngleFromAdjustedCenter - sweepAngle  // Start behind connection point
      : connectionAngleFromAdjustedCenter + sweepAngle; // Start ahead of connection point
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = sweepCounterClockwise 
        ? startAngle + t * sweepAngle     // Sweep counter-clockwise to connection
        : startAngle - t * sweepAngle;    // Sweep clockwise to connection
      
      if (i === segments) {
        // Ensure last point is exactly the connection point
        points.push(connectionPoint);
      } else if (i === segments - 1) {
        // Special handling for second-to-last point to ensure tangency
        // Position it along the tangent direction from the connection point
        const segmentLength = radius * sweepAngle / segments; // Approximate segment length
        const backwardTangent = { x: -tangent.x, y: -tangent.y }; // Opposite direction
        points.push({
          x: connectionPoint.x + backwardTangent.x * segmentLength,
          y: connectionPoint.y + backwardTangent.y * segmentLength
        });
      } else {
        points.push({
          x: adjustedCenter.x + radius * Math.cos(angle),
          y: adjustedCenter.y + radius * Math.sin(angle)
        });
      }
    }
  } else {
    // Lead-out: arc starts at connection point and curves away
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = sweepCounterClockwise 
        ? connectionAngleFromAdjustedCenter + t * sweepAngle  // Sweep counter-clockwise from connection
        : connectionAngleFromAdjustedCenter - t * sweepAngle; // Sweep clockwise from connection
      
      if (i === 0) {
        // Ensure first point is exactly the connection point
        points.push(connectionPoint);
      } else if (i === 1) {
        // Special handling for second point to ensure tangency
        // Position it along the tangent direction from the connection point
        const segmentLength = radius * sweepAngle / segments; // Approximate segment length
        points.push({
          x: connectionPoint.x + tangent.x * segmentLength,
          y: connectionPoint.y + tangent.y * segmentLength
        });
      } else {
        points.push({
          x: adjustedCenter.x + radius * Math.cos(angle),
          y: adjustedCenter.y + radius * Math.sin(angle)
        });
      }
    }
  }

  return points;
}

/**
 * Generate points along a tangent line lead.
 * The line starts tangent to the chain and extends in the specified direction.
 */
function generateTangentLinePoints(
  connectionPoint: Point2D,
  lineLength: number,
  isLeadIn: boolean,
  tangent: Point2D,
  leadDirection: Point2D
): Point2D[] {
  const points: Point2D[] = [];
  
  // For line leads, we create a straight line that extends from the connection point
  // in the specified lead direction
  
  if (isLeadIn) {
    // Lead-in: line starts away from connection and ends at connection point
    // leadDirection points FROM connection TO start, so we ADD it for lead-in
    const startPoint: Point2D = {
      x: connectionPoint.x + leadDirection.x * lineLength,
      y: connectionPoint.y + leadDirection.y * lineLength
    };
    
    // Generate points along the line (start to connection)
    const segments = Math.max(2, Math.ceil(lineLength / 2)); // Approximate 2mm segments, minimum 2 points
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      if (i === segments) {
        // Ensure last point is exactly the connection point
        points.push(connectionPoint);
      } else {
        points.push({
          x: startPoint.x + (connectionPoint.x - startPoint.x) * t,
          y: startPoint.y + (connectionPoint.y - startPoint.y) * t
        });
      }
    }
  } else {
    // Lead-out: line starts at connection point and extends away
    // leadDirection points FROM connection TO end, so we ADD it for lead-out
    const endPoint: Point2D = {
      x: connectionPoint.x + leadDirection.x * lineLength,
      y: connectionPoint.y + leadDirection.y * lineLength
    };
    
    // Generate points along the line (connection to end)
    const segments = Math.max(2, Math.ceil(lineLength / 2)); // Approximate 2mm segments, minimum 2 points
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      if (i === 0) {
        // Ensure first point is exactly the connection point
        points.push(connectionPoint);
      } else {
        points.push({
          x: connectionPoint.x + (endPoint.x - connectionPoint.x) * t,
          y: connectionPoint.y + (endPoint.y - connectionPoint.y) * t
        });
      }
    }
  }

  return points;
}

/**
 * Normalize an angle to be between -π and π
 */
function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Get the start point of a chain.
 */
function getChainStartPoint(chain: ShapeChain): Point2D | null {
  if (chain.shapes.length === 0) return null;
  
  const firstShape = chain.shapes[0];
  switch (firstShape.type) {
    case 'line':
      return (firstShape.geometry as any).start;
    case 'arc':
      // Arc start point calculation
      const arc = firstShape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'circle':
      // For circles, use the rightmost point as start
      const circle = firstShape.geometry as any;
      return {
        x: circle.center.x + circle.radius,
        y: circle.center.y
      };
    case 'polyline':
      return (firstShape.geometry as any).points[0];
    default:
      return null;
  }
}

/**
 * Get the end point of a chain.
 */
function getChainEndPoint(chain: ShapeChain): Point2D | null {
  if (chain.shapes.length === 0) return null;
  
  const lastShape = chain.shapes[chain.shapes.length - 1];
  switch (lastShape.type) {
    case 'line':
      return (lastShape.geometry as any).end;
    case 'arc':
      // Arc end point calculation
      const arc = lastShape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'circle':
      // For circles, end point is same as start point
      const circle = lastShape.geometry as any;
      return {
        x: circle.center.x + circle.radius,
        y: circle.center.y
      };
    case 'polyline':
      const points = (lastShape.geometry as any).points;
      return points[points.length - 1];
    default:
      return null;
  }
}

/**
 * Get the tangent direction at a point on the chain.
 */
function getChainTangent(chain: ShapeChain, point: Point2D, isStart: boolean): Point2D {
  if (chain.shapes.length === 0) {
    return { x: 1, y: 0 }; // Default to horizontal
  }

  const shape = isStart ? chain.shapes[0] : chain.shapes[chain.shapes.length - 1];
  
  switch (shape.type) {
    case 'line':
      // Line tangent is just the line direction
      const line = shape.geometry as any;
      const dx = line.end.x - line.start.x;
      const dy = line.end.y - line.start.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      return len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };

    case 'arc':
      // Arc tangent is perpendicular to radius at the point
      const arc = shape.geometry as any;
      const angle = isStart ? arc.startAngle : arc.endAngle;
      // Tangent is perpendicular to radius
      // If arc goes counterclockwise, tangent points in +90° direction
      // If arc goes clockwise, tangent points in -90° direction
      const isCounterClockwise = arc.endAngle > arc.startAngle;
      const tangentAngle = angle + (isCounterClockwise ? Math.PI / 2 : -Math.PI / 2);
      return {
        x: Math.cos(tangentAngle),
        y: Math.sin(tangentAngle)
      };

    case 'circle':
      // Circle tangent at any point is perpendicular to radius
      const circle = shape.geometry as any;
      const cdx = point.x - circle.center.x;
      const cdy = point.y - circle.center.y;
      const clen = Math.sqrt(cdx * cdx + cdy * cdy);
      if (clen > 0) {
        // Tangent is perpendicular to radius, assuming counterclockwise
        return { x: -cdy / clen, y: cdx / clen };
      }
      return { x: 1, y: 0 };

    case 'polyline':
      // Polyline tangent at start/end
      const points = (shape.geometry as any).points;
      if (isStart && points.length >= 2) {
        const dx = points[1].x - points[0].x;
        const dy = points[1].y - points[0].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        return len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
      } else if (!isStart && points.length >= 2) {
        const n = points.length;
        const dx = points[n - 1].x - points[n - 2].x;
        const dy = points[n - 1].y - points[n - 2].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        return len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
      }
      return { x: 1, y: 0 };

    default:
      return { x: 1, y: 0 };
  }
}

/**
 * Calculate the curve direction for lead placement.
 * This determines which side of the tangent line the arc curves to.
 * Uses cut direction and hole/shell context for proper tangency.
 */
function getLeadCurveDirection(
  tangent: Point2D,
  isHole: boolean,
  isShell: boolean,
  cutDirection: CutDirection,
  chain: ShapeChain,
  point: Point2D,
  part?: DetectedPart,
  leadLength?: number,
  flipSide: boolean = false
): Point2D {
  // Base normal directions (perpendicular to tangent)
  const leftNormal = { x: -tangent.y, y: tangent.x };   // 90° counterclockwise
  const rightNormal = { x: tangent.y, y: -tangent.x };  // 90° clockwise

  let selectedDirection: Point2D = leftNormal; // Default fallback

  // Use cut direction to determine lead placement for proper tangency
  if (cutDirection !== 'none') {
    // For shells (outer boundaries):
    if (isShell) {
      // Check if there are nearby holes that could provide better lead placement
      const nearbyHoleDirection = getNearbyHoleDirection(chain, point, tangent, part, leadLength);
      if (nearbyHoleDirection) {
        selectedDirection = nearbyHoleDirection;
      } else {
        // Default: leads should be placed outside the part
        // For clockwise cuts: lead curves to maintain clockwise flow
        // For counterclockwise cuts: lead curves to maintain counterclockwise flow
        selectedDirection = cutDirection === CutDirection.CLOCKWISE ? rightNormal : leftNormal;
      }
    }
    
    // For holes (inner boundaries):
    else if (isHole) {
      // Leads should be placed inside the hole (away from solid material)
      // For clockwise holes: lead curves opposite to shell direction
      // For counterclockwise holes: lead curves opposite to shell direction
      selectedDirection = cutDirection === CutDirection.CLOCKWISE ? leftNormal : rightNormal;
    }
    
    // For chains without part context, still respect cut direction
    else if (!isHole && !isShell) {
      // Default behavior: assume it's an outer boundary
      selectedDirection = cutDirection === CutDirection.CLOCKWISE ? rightNormal : leftNormal;
    }
  }
  // Fallback: If no cut direction is specified, use geometric analysis
  else {
    // For shells, try to place leads outward
    if (isShell) {
      const outwardNormal = calculateLocalOutwardNormal(chain, point, tangent);
      if (outwardNormal) {
        selectedDirection = outwardNormal;
      } else {
        selectedDirection = leftNormal; // Default fallback
      }
    }
    // For holes, try to place leads inward
    else if (isHole) {
      const outwardNormal = calculateLocalOutwardNormal(chain, point, tangent);
      if (outwardNormal) {
        // For holes, we want the opposite of outward (inward)
        selectedDirection = { x: -outwardNormal.x, y: -outwardNormal.y };
      } else {
        selectedDirection = leftNormal; // Default fallback
      }
    }
    // Final fallback: use centroid-based approach
    else {
      const centroid = calculateChainCentroid(chain);
      const toCentroid = {
        x: centroid.x - point.x,
        y: centroid.y - point.y
      };

      const toCentroidLen = Math.sqrt(toCentroid.x * toCentroid.x + toCentroid.y * toCentroid.y);
      if (toCentroidLen > 0) {
        toCentroid.x /= toCentroidLen;
        toCentroid.y /= toCentroidLen;
      }

      if (isHole) {
        const leftDot = leftNormal.x * toCentroid.x + leftNormal.y * toCentroid.y;
        const rightDot = rightNormal.x * toCentroid.x + rightNormal.y * toCentroid.y;
        selectedDirection = leftDot > rightDot ? leftNormal : rightNormal;
      } else if (isShell) {
        const leftDot = leftNormal.x * toCentroid.x + leftNormal.y * toCentroid.y;
        const rightDot = rightNormal.x * toCentroid.x + rightNormal.y * toCentroid.y;
        selectedDirection = leftDot < rightDot ? leftNormal : rightNormal;
      } else {
        selectedDirection = leftNormal;
      }
    }
  }

  // Apply flip if requested
  if (flipSide) {
    selectedDirection = { x: -selectedDirection.x, y: -selectedDirection.y };
  }

  return selectedDirection;
}

/**
 * Check if there are nearby holes that could provide space for lead placement.
 * Returns a direction toward the nearest accessible hole, or null if none found.
 */
function getNearbyHoleDirection(
  chain: ShapeChain,
  point: Point2D,
  tangent: Point2D,
  part?: DetectedPart,
  leadLength?: number
): Point2D | null {
  if (!part || part.holes.length === 0) {
    return null;
  }
  
  // Only consider holes that are reachable by the lead length
  // Use a reasonable multiplier (e.g., 3x lead length) to account for arc curvature
  const maxReachableDistance = leadLength ? leadLength * 3 : 50;

  // Base normal directions (perpendicular to tangent)
  const leftNormal = { x: -tangent.y, y: tangent.x };   // 90° counterclockwise
  const rightNormal = { x: tangent.y, y: -tangent.x };  // 90° clockwise

  let nearestHole: { distance: number; direction: Point2D } | null = null;

  // Check each hole to find the nearest one
  for (const hole of part.holes) {
    // Calculate hole center
    const holeCenter = calculateChainCentroid(hole.chain);
    
    
    // Vector from connection point to hole center
    const toHole = {
      x: holeCenter.x - point.x,
      y: holeCenter.y - point.y
    };
    
    const distance = Math.sqrt(toHole.x * toHole.x + toHole.y * toHole.y);
    
    // Normalize the direction
    if (distance > 0) {
      toHole.x /= distance;
      toHole.y /= distance;
    }
    
    // Check if hole is reachable by the lead length
    if (distance < maxReachableDistance) {
      // Determine which normal direction (left or right) points more toward the hole
      const leftDot = leftNormal.x * toHole.x + leftNormal.y * toHole.y;
      const rightDot = rightNormal.x * toHole.x + rightNormal.y * toHole.y;
      
      // Choose the normal that points more toward the hole
      const holeDirection = leftDot > rightDot ? leftNormal : rightNormal;
      
      // Track the nearest hole
      if (!nearestHole || distance < nearestHole.distance) {
        nearestHole = { distance, direction: holeDirection };
      }
    }
  }

  return nearestHole ? nearestHole.direction : null;
}

/**
 * Calculate the local outward normal using curvature analysis.
 * This works by analyzing adjacent points to determine which direction leads away from the shape.
 */
function calculateLocalOutwardNormal(
  chain: ShapeChain,
  point: Point2D,
  tangent: Point2D
): Point2D | null {
  // Find the shape and position within the chain that corresponds to this point
  const shapeInfo = findPointInChain(chain, point);
  if (!shapeInfo) {
    return null;
  }

  // Get adjacent points for curvature analysis
  const adjacentPoints = getAdjacentPoints(chain, shapeInfo);
  if (!adjacentPoints) {
    return null;
  }


  const { prev, next } = adjacentPoints;
  
  // Calculate vectors from point to adjacent points
  const toPrev = { x: prev.x - point.x, y: prev.y - point.y };
  const toNext = { x: next.x - point.x, y: next.y - point.y };
  
  // Normalize vectors
  const prevLen = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
  const nextLen = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);
  
  if (prevLen > 0) {
    toPrev.x /= prevLen;
    toPrev.y /= prevLen;
  }
  
  if (nextLen > 0) {
    toNext.x /= nextLen;
    toNext.y /= nextLen;
  }
  
  // Calculate the bisector of the angle formed by adjacent points
  const bisector = {
    x: (toPrev.x + toNext.x) / 2,
    y: (toPrev.y + toNext.y) / 2
  };
  
  // Normalize bisector
  const bisectorLen = Math.sqrt(bisector.x * bisector.x + bisector.y * bisector.y);
  if (bisectorLen > 0) {
    bisector.x /= bisectorLen;
    bisector.y /= bisectorLen;
  }
  
  // The outward normal should point away from the bisector for convex areas,
  // or in the direction of the bisector for concave areas
  
  // Cross product to determine if we're in a convex or concave area
  // Using the turn direction from prev -> current -> next
  const cross = (toNext.x - toPrev.x) * tangent.y - (toNext.y - toPrev.y) * tangent.x;
  
  // Base normal directions
  const leftNormal = { x: -tangent.y, y: tangent.x };   // 90° counterclockwise
  const rightNormal = { x: tangent.y, y: -tangent.x };  // 90° clockwise
  
  // For convex curves (cross < 0), use the normal that points away from the bisector
  // For concave curves (cross > 0), use the normal that points with the bisector
  if (Math.abs(cross) < 0.001) {
    // Nearly straight - use default left normal
    return leftNormal;
  }
  
  // Determine which normal points more away from the shape
  const leftDotBisector = leftNormal.x * bisector.x + leftNormal.y * bisector.y;
  const rightDotBisector = rightNormal.x * bisector.x + rightNormal.y * bisector.y;
  
  if (cross > 0) {
    // Concave area - bisector points inward, so choose normal that opposes it
    return leftDotBisector < rightDotBisector ? leftNormal : rightNormal;
  } else {
    // Convex area - bisector points outward, so choose normal that aligns with it
    return leftDotBisector > rightDotBisector ? leftNormal : rightNormal;
  }
}

/**
 * Find which shape and position within a chain corresponds to a given point.
 */
function findPointInChain(chain: ShapeChain, targetPoint: Point2D): { shapeIndex: number; isStart: boolean } | null {
  const tolerance = 0.001;
  
  for (let i = 0; i < chain.shapes.length; i++) {
    const shape = chain.shapes[i];
    
    // Check start and end points of each shape
    const startPoint = getShapeStartPoint(shape);
    const endPoint = getShapeEndPoint(shape);
    
    if (startPoint && distance(startPoint, targetPoint) < tolerance) {
      return { shapeIndex: i, isStart: true };
    }
    
    if (endPoint && distance(endPoint, targetPoint) < tolerance) {
      return { shapeIndex: i, isStart: false };
    }
  }
  
  return null;
}

/**
 * Get adjacent points for curvature analysis.
 */  
function getAdjacentPoints(
  chain: ShapeChain, 
  shapeInfo: { shapeIndex: number; isStart: boolean }
): { prev: Point2D; next: Point2D } | null {
  const { shapeIndex, isStart } = shapeInfo;
  const shapes = chain.shapes;
  const currentShape = shapes[shapeIndex];
  
  // Special handling for polylines since they contain multiple points
  if (currentShape.type === 'polyline') {
    const points = (currentShape.geometry as any).points;
    
    if (isStart) {
      // For polyline start, prev is the second-to-last point (since last = first in closed polylines)
      const prevPoint = points[points.length - 2];
      const nextPoint = points[1]; // Second point in polyline
      
      if (prevPoint && nextPoint) {
        return { prev: prevPoint, next: nextPoint };
      }
    } else {
      // For polyline end, prev is second-to-last, next is from next shape
      const prevPoint = points[points.length - 2];
      const nextShape = shapes[(shapeIndex + 1) % shapes.length];
      const nextStart = getShapeStartPoint(nextShape);
      
      if (prevPoint && nextStart) {
        return { prev: prevPoint, next: nextStart };
      }
    }
  }
  
  // Original logic for non-polyline shapes
  if (isStart) {
    // Point is at the start of a shape
    const prevShape = shapes[(shapeIndex - 1 + shapes.length) % shapes.length];
    const nextShape = shapes[shapeIndex];
    
    const currentStart = getShapeStartPoint(currentShape);
    const prevEnd = getShapeEndPoint(prevShape);
    const nextPoint = getShapePointAfterStart(nextShape);
    
    if (currentStart && prevEnd && nextPoint) {
      return { prev: prevEnd, next: nextPoint };
    }
  } else {
    // Point is at the end of a shape
    const nextShape = shapes[(shapeIndex + 1) % shapes.length];
    
    const currentEnd = getShapeEndPoint(currentShape);
    const prevPoint = getShapePointBeforeEnd(currentShape);
    const nextStart = getShapeStartPoint(nextShape);
    
    if (currentEnd && prevPoint && nextStart) {
      return { prev: prevPoint, next: nextStart };
    }
  }
  
  return null;
}

/**
 * Helper functions for getting shape points
 */
function getShapeStartPoint(shape: any): Point2D | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.start;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'circle':
      const circle = shape.geometry;
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    case 'polyline':
      return shape.geometry.points[0];
    default:
      return null;
  }
}

function getShapeEndPoint(shape: any): Point2D | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.end;
    case 'arc':
      const arc = shape.geometry;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'circle':
      const circle = shape.geometry;
      return { x: circle.center.x + circle.radius, y: circle.center.y };
    case 'polyline':
      const points = shape.geometry.points;
      return points[points.length - 1];
    default:
      return null;
  }
}

function getShapePointAfterStart(shape: any): Point2D | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.end;
    case 'arc':
      const arc = shape.geometry;
      const midAngle = (arc.startAngle + arc.endAngle) / 2;
      return {
        x: arc.center.x + arc.radius * Math.cos(midAngle),
        y: arc.center.y + arc.radius * Math.sin(midAngle)
      };
    case 'circle':
      const circle = shape.geometry;
      return { x: circle.center.x, y: circle.center.y + circle.radius };
    case 'polyline':
      const points = shape.geometry.points;
      return points.length > 1 ? points[1] : points[0];
    default:
      return null;
  }
}

function getShapePointBeforeEnd(shape: any): Point2D | null {
  switch (shape.type) {
    case 'line':
      return shape.geometry.start;
    case 'arc':
      const arc = shape.geometry;
      const midAngle = (arc.startAngle + arc.endAngle) / 2;
      return {
        x: arc.center.x + arc.radius * Math.cos(midAngle),
        y: arc.center.y + arc.radius * Math.sin(midAngle)
      };
    case 'circle':
      const circle = shape.geometry;
      return { x: circle.center.x - circle.radius, y: circle.center.y };
    case 'polyline':
      const points = shape.geometry.points;
      return points.length > 1 ? points[points.length - 2] : points[0];
    default:
      return null;
  }
}

function distance(p1: Point2D, p2: Point2D): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Calculate the centroid of a chain for determining inside/outside.
 */
function calculateChainCentroid(chain: ShapeChain): Point2D {
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const shape of chain.shapes) {
    const points = getShapePoints(shape);
    for (const point of points) {
      sumX += point.x;
      sumY += point.y;
      count++;
    }
  }

  return count > 0 
    ? { x: sumX / count, y: sumY / count }
    : { x: 0, y: 0 };
}

/**
 * Get sample points from a shape for centroid calculation.
 */
function getShapePoints(shape: any): Point2D[] {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return [line.start, line.end];
    case 'arc':
      // Sample a few points along the arc
      const arc = shape.geometry as any;
      const points: Point2D[] = [];
      const segments = 4;
      for (let i = 0; i <= segments; i++) {
        const angle = arc.startAngle + (arc.endAngle - arc.startAngle) * i / segments;
        points.push({
          x: arc.center.x + arc.radius * Math.cos(angle),
          y: arc.center.y + arc.radius * Math.sin(angle)
        });
      }
      return points;
    case 'circle':
      // Sample points around circle
      const circle = shape.geometry as any;
      return [
        { x: circle.center.x + circle.radius, y: circle.center.y },
        { x: circle.center.x, y: circle.center.y + circle.radius },
        { x: circle.center.x - circle.radius, y: circle.center.y },
        { x: circle.center.x, y: circle.center.y - circle.radius }
      ];
    case 'polyline':
      return (shape.geometry as any).points;
    default:
      return [];
  }
}

/**
 * Rotate a curve direction vector by the specified angle
 */
function rotateCurveDirection(direction: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  
  return {
    x: direction.x * cos - direction.y * sin,
    y: direction.x * sin + direction.y * cos
  };
}

/**
 * Count how many points in the lead are in solid areas of the part.
 * Excludes the connection point from the check since it's on the boundary.
 */
function countSolidAreaPoints(points: Point2D[], part: DetectedPart, connectionPoint?: Point2D): number {
  let solidPoints = 0;
  // Check each point in the lead
  for (const leadPoint of points) {
    // Skip the connection point as it's expected to be on the boundary
    if (connectionPoint && 
        Math.abs(leadPoint.x - connectionPoint.x) < 0.001 && 
        Math.abs(leadPoint.y - connectionPoint.y) < 0.001) {
      continue;
    }
    
    if (isPointInSolidArea(leadPoint, part)) {
      solidPoints++;
    }
  }
  return solidPoints;
}

/**
 * Check if any points in the lead intersect with solid areas of the part.
 * Solid areas are regions inside the shell but outside any holes.
 */
function leadIntersectsSolidArea(points: Point2D[], part: DetectedPart): boolean {
  return countSolidAreaPoints(points, part) > 0;
}

/**
 * Check if a point is inside the solid area of a part.
 * A point is in solid area if it's inside the shell but outside all holes.
 * Uses proper point-in-polygon detection with ray casting algorithm.
 */
function isPointInSolidArea(point: Point2D, part: DetectedPart): boolean {
  // First check if point is inside the shell using ray casting
  const shellPolygon = getPolygonFromChain(part.shell.chain);
  if (!pointInPolygon(point, shellPolygon)) {
    return false; // Not inside shell, definitely not in solid area
  }

  // Check if point is inside any hole using ray casting
  for (const hole of part.holes) {
    const holePolygon = getPolygonFromChain(hole.chain);
    if (pointInPolygon(point, holePolygon)) {
      return false; // Inside hole, not solid area
    }
  }

  return true; // Inside shell, outside all holes = solid area
}

/**
 * Extract polygon points from a chain for point-in-polygon testing.
 */
function getPolygonFromChain(chain: ShapeChain): Point2D[] {
  const points: Point2D[] = [];
  
  for (const shape of chain.shapes) {
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        points.push(line.start);
        break;
        
      case 'arc':
        // Sample points along the arc
        const arc = shape.geometry as any;
        const segments = Math.max(8, Math.ceil(Math.abs(arc.endAngle - arc.startAngle) * arc.radius / 2));
        for (let i = 0; i < segments; i++) {
          const t = i / segments;
          const angle = arc.startAngle + (arc.endAngle - arc.startAngle) * t;
          points.push({
            x: arc.center.x + arc.radius * Math.cos(angle),
            y: arc.center.y + arc.radius * Math.sin(angle)
          });
        }
        break;
        
      case 'circle':
        // Sample points around the circle
        const circle = shape.geometry as any;
        const circleSegments = Math.max(16, Math.ceil(2 * Math.PI * circle.radius / 2));
        for (let i = 0; i < circleSegments; i++) {
          const angle = (2 * Math.PI * i) / circleSegments;
          points.push({
            x: circle.center.x + circle.radius * Math.cos(angle),
            y: circle.center.y + circle.radius * Math.sin(angle)
          });
        }
        break;
        
      case 'polyline':
        const polyline = shape.geometry as any;
        points.push(...polyline.points);
        break;
        
      default:
        // For other shape types, use bounding points
        const shapePoints = getShapePoints(shape);
        points.push(...shapePoints);
        break;
    }
  }
  
  return points;
}

/**
 * Point-in-polygon test using ray casting algorithm.
 * Returns true if point is inside the polygon.
 */
function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  if (polygon.length < 3) return false;
  
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

/**
 * Check if a point is inside a bounding box
 */
function isPointInBoundingBox(point: Point2D, bbox: { minX: number; maxX: number; minY: number; maxY: number }): boolean {
  return point.x >= bbox.minX && 
         point.x <= bbox.maxX && 
         point.y >= bbox.minY && 
         point.y <= bbox.maxY;
}

/**
 * Check if leads would collide with each other or with paths.
 * This is a placeholder for the actual collision detection logic.
 */
export function checkLeadCollisions(
  leadResult: LeadResult,
  allPaths: any[],
  currentPath: any
): boolean {
  // TODO: Implement collision detection
  // - Check if lead-in crosses lead-out
  // - Check if leads cross other paths
  // - Check if leads cross other leads
  
  return false; // No collisions for now
}