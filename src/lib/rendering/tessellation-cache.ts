/**
 * Tessellation Cache for Canvas Performance Optimization
 *
 * Caches tessellated points for complex shapes (splines, ellipses) to avoid
 * expensive recalculation on every render frame.
 */

import type { Ellipse, Point2D, Shape } from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import { tessellateSpline } from '$lib/geometry/spline';
import {
    ELLIPSE_TESSELLATION_POINTS,
    tessellateEllipse,
} from '$lib/geometry/ellipse/index';
import { EXTENDED_TIMEOUT_MS, STANDARD_TIMEOUT_MS } from '../constants';

interface CachedTessellation {
    points: Point2D[];
    shapeHash: string;
    timestamp: number;
}

/**
 * Generate a hash key for a shape to detect when tessellation needs updating
 */
function generateShapeHash(shape: Shape): string {
    switch (shape.type) {
        case 'spline': {
            const spline = shape.geometry as Spline;
            return `spline-${shape.id}-${spline.degree}-${spline.controlPoints.length}-${spline.closed}`;
        }
        case 'ellipse': {
            const ellipse = shape.geometry as Ellipse;
            return `ellipse-${shape.id}-${ellipse.center.x}-${ellipse.center.y}-${ellipse.minorToMajorRatio}`;
        }
        default:
            return `${shape.type}-${shape.id}`;
    }
}

/**
 * Tessellation cache with LRU eviction
 */
class TessellationCache {
    private cache = new Map<string, CachedTessellation>();
    private maxSize = STANDARD_TIMEOUT_MS; // Maximum cached shapes
    private maxAge = EXTENDED_TIMEOUT_MS; // 1 minute max age

    /**
     * Get cached tessellation points for a shape
     */
    get(shape: Shape): Point2D[] | null {
        const hash = generateShapeHash(shape);
        const cached = this.cache.get(hash);

        if (!cached) return null;

        // Check if cache entry is too old
        if (Date.now() - cached.timestamp > this.maxAge) {
            this.cache.delete(hash);
            return null;
        }

        // Move to end (LRU)
        this.cache.delete(hash);
        this.cache.set(hash, cached);

        return cached.points;
    }

    /**
     * Cache tessellation points for a shape
     */
    set(shape: Shape, points: Point2D[]): void {
        const hash = generateShapeHash(shape);

        // Evict oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(hash, {
            points: [...points], // Copy array to prevent mutations
            shapeHash: hash,
            timestamp: Date.now(),
        });
    }

    /**
     * Clear all cached tessellations
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Remove expired cache entries
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.maxAge) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics for debugging
     */
    getStats(): { size: number; maxSize: number; hitRate?: number } {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
        };
    }
}

// Global tessellation cache instance
const tessellationCache = new TessellationCache();

/**
 * Get tessellated points for a shape with caching
 */
export function getCachedTessellation(shape: Shape): Point2D[] | null {
    // Only cache complex shapes that benefit from tessellation
    if (shape.type !== 'spline' && shape.type !== 'ellipse') {
        return null;
    }

    // Try to get from cache first
    const cached = tessellationCache.get(shape);
    if (cached) {
        return cached;
    }

    // Calculate and cache tessellation
    let points: Point2D[] = [];

    try {
        if (shape.type === 'spline') {
            const spline = shape.geometry as Spline;
            const result = tessellateSpline(spline, {
                method: 'verb-nurbs',
                tolerance: 0.1,
            });

            if (result.success) {
                points = result.points;
            }
        } else if (shape.type === 'ellipse') {
            const ellipse = shape.geometry as Ellipse;
            // Use a reasonable number of points for caching
            points = tessellateEllipse(ellipse, ELLIPSE_TESSELLATION_POINTS);
        }

        if (points.length > 0) {
            tessellationCache.set(shape, points);
            return points;
        }
    } catch (error) {
        console.warn(`Failed to tessellate ${shape.type} ${shape.id}:`, error);
    }

    return null;
}

/**
 * Clear tessellation cache (call when shapes are modified)
 */
export function clearTessellationCache(): void {
    tessellationCache.clear();
}

/**
 * Clean up expired cache entries
 */
export function cleanupTessellationCache(): void {
    tessellationCache.cleanup();
}

/**
 * Get cache statistics for debugging
 */
export function getTessellationCacheStats(): { size: number; maxSize: number } {
    return tessellationCache.getStats();
}
