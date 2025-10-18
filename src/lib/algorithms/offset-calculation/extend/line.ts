import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import { EPSILON } from '$lib/geometry/math/constants';
import { MAX_EXTENSION_MM } from '$lib/algorithms/offset-calculation/constants';
import {
    calculateLineParameter,
    pointDistance,
} from '$lib/algorithms/offset-calculation/shared/trim-extend-utils';
import { calculateLineDirectionAndLength } from '$lib/geometry/line/functions';

/**
 * Line Extension Module
 *
 * This module provides comprehensive line extension functionality including:
 * - Simple bilateral extension (original functionality)
 * - Intelligent directional extension
 * - Extension to specific target points
 * - Extension parameter calculation
 */

/**
 * Extension direction options
 */
export type LineExtensionDirection = 'start' | 'end' | 'both' | 'auto';

/**
 * Extension options for line operations
 */
export interface LineExtensionOptions {
    /** Maximum distance to extend */
    maxExtension?: number;
    /** Geometric tolerance */
    tolerance?: number;
    /** Which end to extend */
    direction?: LineExtensionDirection;
}

/**
 * Result of line extension calculation
 */
export interface LineExtensionResult {
    /** Whether the extension calculation succeeded */
    success: boolean;
    /** Distance of extension */
    extensionDistance: number;
    /** Direction of extension */
    direction: 'start' | 'end';
    /** Error message if failed */
    error?: string;
}

/**
 * Create an extended line by extending both endpoints by the specified length
 * (Original simple extension function)
 */
export function createExtendedLine(line: Line, extensionLength: number): Line {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length < EPSILON) {
        // Degenerate line, just return the original
        return line;
    }

    const unitX = dx / length;
    const unitY = dy / length;

    return {
        start: {
            x: line.start.x - unitX * extensionLength,
            y: line.start.y - unitY * extensionLength,
        },
        end: {
            x: line.end.x + unitX * extensionLength,
            y: line.end.y + unitY * extensionLength,
        },
    };
}

/**
 * Extend a line to reach a specific intersection point
 *
 * @param line - The line to extend
 * @param intersectionPoint - Target point to extend to
 * @param options - Extension options
 * @returns Extended line or null if extension failed
 */
export function extendLineToPoint(
    line: Line,
    intersectionPoint: Point2D,
    options: LineExtensionOptions = {}
): Line | null {
    const defaultOptions: LineExtensionOptions = {
        maxExtension: MAX_EXTENSION_MM,
        tolerance: 1e-6,
        direction: 'auto' as LineExtensionDirection,
    };
    const opts: LineExtensionOptions = { ...defaultOptions, ...options };

    try {
        // Calculate line parameters using shared utility
        const lineProps = calculateLineDirectionAndLength(line);
        if (!lineProps) {
            return null; // Degenerate line
        }

        const { unitDirection: unitDir } = lineProps;

        // Determine extension direction
        const extendDirection: 'start' | 'end' | null =
            determineExtensionDirection(line, intersectionPoint, opts);
        if (!extendDirection) {
            return null;
        }

        // Calculate extension parameters
        const extensionInfo: LineExtensionResult = calculateExtension(
            line,
            intersectionPoint,
            extendDirection,
            unitDir
        );
        if (!extensionInfo.success) {
            return null;
        }

        // Validate extension distance
        if (extensionInfo.extensionDistance > opts.maxExtension!) {
            return null;
        }

        // Create extended line
        return createExtendedLineToPoint(
            line,
            intersectionPoint,
            extendDirection,
            extensionInfo
        );
    } catch {
        return null;
    }
}

/**
 * Determine which end of the line should be extended
 */
export function determineExtensionDirection(
    line: Line,
    intersectionPoint: Point2D,
    options: LineExtensionOptions
): 'start' | 'end' | null {
    if (options.direction === 'start' || options.direction === 'end') {
        return options.direction;
    }

    // Auto mode: extend the end that's closer to the intersection point
    const distToStart: number = pointDistance(line.start, intersectionPoint);
    const distToEnd: number = pointDistance(line.end, intersectionPoint);

    // Also consider if the intersection point is along the line's projection
    const lineParam: number = calculateLineParameter(intersectionPoint, line);

    if (lineParam < 0) {
        // Intersection is before line start
        return 'start';
    } else if (lineParam > 1) {
        // Intersection is after line end
        return 'end';
    } else {
        // Intersection is between start and end - this shouldn't happen for gap filling
        // but handle it by extending the closer end
        return distToStart < distToEnd ? 'start' : 'end';
    }
}

/**
 * Calculate extension parameters
 */
export function calculateExtension(
    line: Line,
    intersectionPoint: Point2D,
    direction: 'start' | 'end',
    _unitDir: Point2D
): LineExtensionResult {
    // Project intersection point onto the line to find the extension distance
    const lineParam: number = calculateLineParameter(intersectionPoint, line);

    let extensionDistance: number;

    // Check if point is already on the line (between start and end)
    if (lineParam >= 0 && lineParam <= 1) {
        // Point is on the line, no extension needed
        return { success: true, extensionDistance: 0, direction };
    }

    if (direction === 'start') {
        // Extension backwards from start
        if (lineParam >= 0) {
            return {
                success: false,
                extensionDistance: 0,
                direction,
                error: 'Intersection point is not behind line start',
            };
        }
        extensionDistance =
            Math.abs(lineParam) *
            Math.sqrt(
                (line.end.x - line.start.x) ** 2 +
                    (line.end.y - line.start.y) ** 2
            );
    } else {
        // Extension forwards from end
        if (lineParam <= 1) {
            return {
                success: false,
                extensionDistance: 0,
                direction,
                error: 'Intersection point is not beyond line end',
            };
        }
        extensionDistance =
            (lineParam - 1) *
            Math.sqrt(
                (line.end.x - line.start.x) ** 2 +
                    (line.end.y - line.start.y) ** 2
            );
    }

    return { success: true, extensionDistance, direction };
}

/**
 * Create the extended line geometry to reach a specific point
 */
function createExtendedLineToPoint(
    originalLine: Line,
    intersectionPoint: Point2D,
    direction: 'start' | 'end',
    extensionInfo: { extensionDistance: number }
): Line {
    const lineDir: Point2D = {
        x: originalLine.end.x - originalLine.start.x,
        y: originalLine.end.y - originalLine.start.y,
    };

    const lineLength: number = Math.sqrt(
        lineDir.x * lineDir.x + lineDir.y * lineDir.y
    );
    const unitDir: Point2D = {
        x: lineDir.x / lineLength,
        y: lineDir.y / lineLength,
    };

    if (direction === 'start') {
        // Extend backwards from start
        return {
            start: {
                x:
                    originalLine.start.x -
                    unitDir.x * extensionInfo.extensionDistance,
                y:
                    originalLine.start.y -
                    unitDir.y * extensionInfo.extensionDistance,
            },
            end: originalLine.end,
        };
    } else {
        // Extend forwards from end
        return {
            start: originalLine.start,
            end: {
                x:
                    originalLine.end.x +
                    unitDir.x * extensionInfo.extensionDistance,
                y:
                    originalLine.end.y +
                    unitDir.y * extensionInfo.extensionDistance,
            },
        };
    }
}
