import type { Shape, Point2D, Line } from '$lib/types/geometry';
import type { FillOptions, FillResult, ShapeExtension } from '../types';
import {
    extendLineToPoint,
    determineExtensionDirection,
    calculateExtension,
} from '../../extend/line';
import type { LineExtensionResult } from '../../extend/line';
import { pointDistance } from '../../shared/trim-extend-utils';
import { calculateLineDirectionAndLength } from '../../../../geometry/line';

/**
 * Line Fill Module
 *
 * This module provides gap filling for line shapes by extending them
 * to intersection points. It maintains the perpendicular distance invariant
 * and ensures the extended line portions maintain constant perpendicular
 * distance from the original.
 */

/**
 * Extend a line to reach a specific intersection point
 *
 * @param shape - The line shape to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Fill operation options
 * @returns Result containing the extended line or error information
 */
export function fillLineToIntersection(
    shape: Shape,
    intersectionPoint: Point2D,
    options: FillOptions
): FillResult {
    if (shape.type !== 'line') {
        return createFailureResult('Shape must be a line');
    }

    const line: import('$lib/types/geometry').Line = shape.geometry as Line;

    try {
        // Validate line geometry using shared utility
        const lineProps = calculateLineDirectionAndLength(line);
        if (!lineProps) {
            return createFailureResult('Line is degenerate (zero length)');
        }

        const { direction: lineDir, length: lineLength } = lineProps;

        // Check if extension would exceed maximum before attempting
        const distanceToStart: number = pointDistance(
            intersectionPoint,
            line.start
        );
        const distanceToEnd: number = pointDistance(
            intersectionPoint,
            line.end
        );

        const minExtensionNeeded: number = Math.min(
            Math.max(0, distanceToStart - lineLength),
            Math.max(0, distanceToEnd - lineLength)
        );

        if (minExtensionNeeded > options.maxExtension) {
            return createFailureResult(
                'Extension distance exceeds maximum allowed'
            );
        }

        // Use the extend module for all extension logic
        const extendedLine: Line | null = extendLineToPoint(
            line,
            intersectionPoint,
            {
                maxExtension: options.maxExtension,
                tolerance: options.tolerance,
                direction:
                    options.extendDirection === 'start'
                        ? 'start'
                        : options.extendDirection === 'end'
                          ? 'end'
                          : 'auto',
            }
        );

        if (!extendedLine) {
            return createFailureResult(
                'Failed to extend line to intersection point'
            );
        }

        // Calculate extension info for the shape extension data
        const extendDirection: 'start' | 'end' | null =
            determineExtensionDirection(line, intersectionPoint, {
                maxExtension: options.maxExtension,
                tolerance: options.tolerance,
                direction:
                    options.extendDirection === 'start'
                        ? 'start'
                        : options.extendDirection === 'end'
                          ? 'end'
                          : 'auto',
            });

        if (!extendDirection) {
            return createFailureResult(
                'Could not determine extension direction'
            );
        }

        const unitDir: Point2D = {
            x: lineDir.x / lineLength,
            y: lineDir.y / lineLength,
        };

        const extensionInfo: LineExtensionResult = calculateExtension(
            line,
            intersectionPoint,
            extendDirection,
            unitDir
        );
        if (!extensionInfo.success) {
            return createFailureResult(
                extensionInfo.error || 'Extension calculation failed'
            );
        }

        const extension: ShapeExtension = {
            type: 'linear',
            amount: extensionInfo.extensionDistance,
            direction: extendDirection,
            originalShape: shape,
            extensionStart:
                extendDirection === 'start' ? extendedLine.start : line.end,
            extensionEnd:
                extendDirection === 'start' ? line.start : extendedLine.end,
        };

        return {
            success: true,
            extendedShape: {
                ...shape,
                geometry: extendedLine,
            },
            extension,
            intersectionPoint,
            warnings: [],
            errors: [],
            confidence: 1.0,
        };
    } catch (error) {
        return createFailureResult(
            `Line extension failed: ${error instanceof Error ? (error as Error).message : String(error)}`
        );
    }
}

/**
 * Create a failed fill result
 */
function createFailureResult(error: string): FillResult {
    return {
        success: false,
        extendedShape: null,
        warnings: [],
        errors: [error],
        confidence: 0.0,
    };
}
