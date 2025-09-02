import type { Point2D } from '../../lib/types/geometry';

/**
 * Manages coordinate transformations between different coordinate systems:
 * - Screen coordinates: Browser canvas pixels (Y+ down)
 * - World coordinates: CAD coordinates (Y+ up) 
 * - Canvas coordinates: Canvas drawing coordinates (Y+ down)
 * 
 * The origin is always positioned at 25% from left, 75% from top of the canvas.
 */
export class CoordinateTransformer {
  private totalScale: number;

  constructor(
    private canvas: { width: number; height: number },
    private scale: number,
    private offset: Point2D,
    private physicalScale: number = 1
  ) {
    this.totalScale = scale * physicalScale;
  }

  /**
   * Update canvas dimensions
   */
  updateCanvas(canvas: { width: number; height: number }) {
    this.canvas = canvas;
  }

  /**
   * Update transformation parameters
   */
  updateTransform(scale: number, offset: Point2D, physicalScale?: number) {
    this.scale = scale;
    this.offset = offset;
    if (physicalScale !== undefined) {
      this.physicalScale = physicalScale;
    }
    this.totalScale = this.scale * this.physicalScale;
  }

  /**
   * Get the screen position of the origin (0,0 in world coordinates)
   */
  getScreenOrigin(): Point2D {
    return {
      x: this.canvas.width * 0.25 + this.offset.x,
      y: this.canvas.height * 0.75 + this.offset.y
    };
  }

  /**
   * Convert screen coordinates to world coordinates
   * Screen: pixels with Y+ down, origin at top-left
   * World: CAD units with Y+ up, origin at drawing origin
   */
  screenToWorld(screenPoint: Point2D): Point2D {
    const origin: Point2D = this.getScreenOrigin();
    
    return {
      x: (screenPoint.x - origin.x) / this.totalScale,
      y: -(screenPoint.y - origin.y) / this.totalScale
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   * Inverse of screenToWorld
   */
  worldToScreen(worldPoint: Point2D): Point2D {
    const origin: Point2D = this.getScreenOrigin();
    
    return {
      x: worldPoint.x * this.totalScale + origin.x,
      y: -worldPoint.y * this.totalScale + origin.y
    };
  }

  /**
   * Convert world coordinates to canvas coordinates
   * This only flips the Y-axis, used for canvas drawing operations
   */
  worldToCanvas(worldPoint: Point2D): Point2D {
    return {
      x: worldPoint.x,
      y: -worldPoint.y
    };
  }

  /**
   * Convert canvas coordinates to world coordinates
   * Inverse of worldToCanvas
   */
  canvasToWorld(canvasPoint: Point2D): Point2D {
    return {
      x: canvasPoint.x,
      y: -canvasPoint.y
    };
  }

  /**
   * Calculate the offset needed to zoom toward a specific screen point
   * @param zoomPoint Screen coordinates of the zoom center
   * @param oldScale Previous scale value
   * @param newScale New scale value
   * @returns New offset to maintain zoom point position
   */
  calculateZoomOffset(zoomPoint: Point2D, oldScale: number, newScale: number): Point2D {
    // Get world coordinates of zoom point with current transform
    const worldPoint: Point2D = this.screenToWorld(zoomPoint);
    
    // Calculate where this world point would appear with new scale
    const _oldTotalScale: number = this.totalScale;
    const newTotalScale: number = newScale * this.physicalScale;
    
    const origin: Point2D = this.getScreenOrigin();
    const newScreenX: number = worldPoint.x * newTotalScale + origin.x;
    const newScreenY: number = -worldPoint.y * newTotalScale + origin.y;
    
    // Calculate offset to keep zoom point at same screen position
    return {
      x: this.offset.x + (zoomPoint.x - newScreenX),
      y: this.offset.y + (zoomPoint.y - newScreenY)
    };
  }

  /**
   * Get the current total scale (user scale × physical scale)
   */
  getTotalScale(): number {
    return this.totalScale;
  }

  /**
   * Get the current user scale factor
   */
  getScale(): number {
    return this.scale;
  }

  /**
   * Get the current physical scale factor
   */
  getPhysicalScale(): number {
    return this.physicalScale;
  }

  /**
   * Get the current offset
   */
  getOffset(): Point2D {
    return { ...this.offset };
  }

  /**
   * Convert a distance in world units to screen pixels
   */
  worldToScreenDistance(worldDistance: number): number {
    return worldDistance * this.totalScale;
  }

  /**
   * Convert a distance in screen pixels to world units
   */
  screenToWorldDistance(screenDistance: number): number {
    return screenDistance / this.totalScale;
  }
}