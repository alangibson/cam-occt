import type { Circle, Shape } from '../../../../types/geometry';
import type { OffsetDirection, OffsetResult } from '../types';

/**
 * Offset a circle by the specified distance
 */
export function offsetCircle(circle: Circle, distance: number, direction: OffsetDirection): OffsetResult {
  if (direction === 'none' || distance === 0) {
    return {
      success: true,
      shapes: [],
      warnings: [],
      errors: []
    };
  }

  try {
    // For circles, offset changes the radius
    // Outset increases radius, inset decreases radius
    const offsetDistance: number = direction === 'outset' ? distance : -distance;
    const newRadius: number = circle.radius + offsetDistance;

    if (newRadius <= 0) {
      return {
        success: false,
        shapes: [],
        warnings: [],
        errors: [`Circle offset would result in negative radius: ${newRadius}`]
      };
    }

    const offsetShape: Shape = {
      id: `offset_${Math.random().toString(36).substr(2, 9)}`,
      type: 'circle',
      geometry: {
        center: { ...circle.center },
        radius: newRadius
      } as Circle
    };

    return {
      success: true,
      shapes: [offsetShape],
      warnings: [],
      errors: []
    };
  } catch (error) {
    return {
      success: false,
      shapes: [],
      warnings: [],
      errors: [`Failed to offset circle: ${error instanceof Error ? (error as Error).message : String(error)}`]
    };
  }
}