import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';

/**
 * Default padding around thumbnail as a percentage of the largest dimension
 */
const DEFAULT_THUMBNAIL_PADDING_PERCENT = 0.1;

/**
 * Calculate viewBox for SVG thumbnail that fits the drawing
 *
 * Assumes the drawing has been translated to positive quadrant (min at 0,0)
 * and creates a viewBox that accounts for Y-axis flip (scale(1, -1)).
 *
 * After Y-flip, CAD coordinates (Y-up) become SVG coordinates (Y-down):
 * - CAD (0, 0) → SVG (0, 0)
 * - CAD (0, H) → SVG (0, -H)
 *
 * To position CAD origin (0,0) at bottom-left of thumbnail, viewBox must
 * start at negative Y to capture the flipped geometry.
 *
 * @param bounds - Bounding box of the drawing (should already be in positive quadrant)
 * @param paddingPercent - Padding around the drawing as a percentage (default 10%)
 * @returns viewBox string in format "minX minY width height"
 */
export function calculateThumbnailViewBox(
    bounds: BoundingBoxData,
    paddingPercent: number = DEFAULT_THUMBNAIL_PADDING_PERCENT
): string {
    // Calculate drawing dimensions
    const drawingWidth = bounds.max.x - bounds.min.x;
    const drawingHeight = bounds.max.y - bounds.min.y;

    // Handle edge case of zero-size drawings
    if (drawingWidth === 0 && drawingHeight === 0) {
        return '0 0 100 100';
    }

    // Calculate padding in world units
    const maxDimension = Math.max(drawingWidth, drawingHeight);
    const padding = maxDimension * paddingPercent;

    // Calculate viewBox dimensions with padding
    const viewBoxWidth = drawingWidth + 2 * padding;
    const viewBoxHeight = drawingHeight + 2 * padding;

    // After scale(1, -1) flip, the drawing spans from Y=0 to Y=-drawingHeight
    // ViewBox must start at negative Y to capture flipped geometry
    // This positions CAD origin (0,0) at bottom-left of thumbnail
    const minX = -padding;
    const minY = -(drawingHeight + padding);

    return `${minX} ${minY} ${viewBoxWidth} ${viewBoxHeight}`;
}
