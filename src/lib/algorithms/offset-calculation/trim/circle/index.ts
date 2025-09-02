import type { Shape, Point2D, Circle, Arc } from '$lib/types/geometry';
import { generateId } from '$lib/utils/id';
import { pointDistance } from '..';
import { type KeepSide, type TrimResult } from '../types';


/**
 * Trim a circle by converting it to an arc
 */
export function trimCircle(shape: Shape, point: Point2D, keepSide: KeepSide, tolerance: number): TrimResult {
  const circle: import("$lib/types/geometry").Circle = shape.geometry as Circle;
  const result: TrimResult = {
    success: false,
    shape: null,
    warnings: [],
    errors: []
  };

  // Verify the point is on the circle
  const pointRadius: number = pointDistance(point, circle.center);
  if (Math.abs(pointRadius - circle.radius) > tolerance) {
    result.errors.push('Trim point is not on the circle');
    return result;
  }

  // Convert circle to arc - we need to decide how to split it
  // For now, create an arc that excludes a small section around the trim point
  const pointAngle: number = Math.atan2(point.y - circle.center.y, point.x - circle.center.x);

  // Create a gap of about 0.1 radians (~5.7 degrees) around the trim point
  const gapSize: number = 0.05; // radians on each side

  let startAngle: number;
  let endAngle: number;

  switch (keepSide) {
    case 'start':
    case 'before':
      // Keep everything before the trim point
      startAngle = pointAngle + gapSize;
      endAngle = pointAngle + 2 * Math.PI - gapSize;
      break;
    case 'end':
    case 'after':
      // Keep everything after the trim point  
      startAngle = pointAngle + gapSize;
      endAngle = pointAngle + 2 * Math.PI - gapSize;
      break;
    default:
      result.errors.push(`Invalid keepSide value for circle trimming: ${keepSide}`);
      return result;
  }

  const trimmedArc: Arc = {
    center: { ...circle.center },
    radius: circle.radius,
    startAngle,
    endAngle,
    clockwise: false // Standard counter-clockwise
  };

  result.shape = {
    ...shape,
    id: generateId(),
    type: 'arc',
    geometry: trimmedArc
  };
  result.success = true;
  result.warnings.push('Circle converted to arc for trimming');

  return result;
}
