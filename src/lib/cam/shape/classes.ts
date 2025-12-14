import type { ShapeData, TessellationCache } from './interfaces';
import {
    hashShape,
    tessellateShape,
    translateShape,
    getShapeStartPoint,
    getShapeEndPoint,
    getShapePoints,
    shapeBoundingBox,
    getShapeMidpoint,
    getShapeNormal,
    getShapePointAt,
} from './functions';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import type { Geometry } from '$lib/geometry/types';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Point2D, PointGeometry } from '$lib/geometry/point/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { BoundingBox } from '$lib/geometry/bounding-box/classes';
import type { Geometric } from '$lib/cam/interfaces';

export class Shape implements Geometric, ShapeData {
    #data: ShapeData;
    #tessellationCache?: TessellationCache;
    #tessellated?: Point2D[];
    #startPoint?: Point2D;
    #endPoint?: Point2D;
    #points?: Point2D[];
    #boundary?: BoundingBox;
    #midPoint?: Point2D;
    #normal?: Point2D;
    #pointAt?: Map<number, Point2D | null>;

    constructor(data: ShapeData) {
        if (!data.id) {
            console.error('Shape constructor called with invalid data:', data);
        }
        this.#data = data;
    }

    /**
     * Invalidate all caches when geometry changes
     */
    #invalidateCaches(): void {
        this.#tessellationCache = undefined;
        this.#tessellated = undefined;
        this.#startPoint = undefined;
        this.#endPoint = undefined;
        this.#points = undefined;
        this.#boundary = undefined;
        this.#midPoint = undefined;
        this.#normal = undefined;
        this.#pointAt = undefined;
    }

    get id(): string {
        return this.#data.id;
    }

    get type(): GeometryType {
        return this.#data.type;
    }

    get geometry(): Geometry {
        return this.#data.geometry;
    }

    set geometry(geometry: Geometry) {
        this.#data.geometry = geometry;
        this.#invalidateCaches();
    }

    get layer(): string | undefined {
        return this.#data.layer;
    }

    get tessellation(): TessellationCache {
        if (!this.#tessellationCache) {
            const points = tessellateShape(
                this,
                DEFAULT_PART_DETECTION_PARAMETERS
            );
            this.#tessellationCache = {
                points,
                tolerance:
                    DEFAULT_PART_DETECTION_PARAMETERS.tessellationTolerance,
                timestamp: Date.now(),
            };
        }
        return this.#tessellationCache;
    }

    get tessellated(): Point2D[] {
        if (!this.#tessellated) {
            this.#tessellated = tessellateShape(
                this,
                DEFAULT_PART_DETECTION_PARAMETERS
            );
        }
        return this.#tessellated;
    }

    get startPoint(): Point2D {
        if (!this.#startPoint) {
            this.#startPoint = getShapeStartPoint(this);
        }
        return this.#startPoint;
    }

    get endPoint(): Point2D {
        if (!this.#endPoint) {
            this.#endPoint = getShapeEndPoint(this);
        }
        return this.#endPoint;
    }

    get points(): Point2D[] {
        if (!this.#points) {
            this.#points = getShapePoints(this, {
                mode: 'CHAIN_DETECTION',
            });
        }
        return this.#points;
    }

    /**
     * Get the bounding box for this shape
     * Lazily calculates and caches the bounding box on first access
     *
     * @returns BoundingBox instance for spatial operations
     */
    get boundary(): BoundingBox {
        if (!this.#boundary) {
            const boundingBoxData = shapeBoundingBox(this);
            this.#boundary = new BoundingBox(boundingBoxData);
        }
        return this.#boundary;
    }

    /**
     * Get the midpoint of this shape at t=0.5
     * Lazily calculates and caches the result on first access
     *
     * @returns Midpoint or null if shape doesn't support midpoint calculation
     */
    get midPoint(): Point2D {
        if (this.#midPoint === undefined) {
            this.#midPoint = getShapeMidpoint(this, 0.5);
        }
        return this.#midPoint;
    }

    /**
     * Get the normal vector at the midpoint (t=0.5) of this shape
     * Lazily calculates and caches the result on first access
     *
     * @returns Normal vector at midpoint
     */
    get normal(): Point2D {
        if (!this.#normal) {
            this.#normal = getShapeNormal(this, 0.5);
        }
        return this.#normal;
    }

    /**
     * Get the point at a specific position along the shape
     * Lazily calculates and caches results
     *
     * @param t Parameter value from 0 to 1 (0 = start, 1 = end)
     * @returns Point at the specified position along the shape, or null if unavailable
     */
    pointAt(t: number): Point2D {
        if (!this.#pointAt) {
            this.#pointAt = new Map();
        }

        if (!this.#pointAt.has(t)) {
            this.#pointAt.set(t, getShapePointAt(this, t));
        }

        return this.#pointAt.get(t)!;
    }

    translate(dx: number, dy: number): void {
        translateShape(this, dx, dy);
        this.#invalidateCaches();
    }

    toData(): ShapeData {
        return this.#data;
    }

    /**
     * Generate a content hash for this shape
     * @returns A SHA-256 hash as a hex string
     */
    async hash(): Promise<string> {
        return hashShape(this);
    }

    /**
     * Create a deep clone of this shape
     * Clones all geometry data recursively
     * @param preserveId If true, preserves the original shape ID; if false, generates a new ID
     * @returns A new Shape instance with cloned data
     */
    clone(preserveId: boolean = false): Shape {
        return new Shape({
            id: preserveId ? this.#data.id : crypto.randomUUID(),
            type: this.#data.type,
            geometry: this.#cloneGeometry(this.#data.geometry),
            layer: this.#data.layer,
        });
    }

    /**
     * Deep clone geometry object based on its type
     * @param geometry The geometry to clone
     * @returns A deep copy of the geometry
     */
    #cloneGeometry(geometry: Geometry): Geometry {
        // Clone Point2D helper
        const clonePoint = (p: { x: number; y: number }) => ({
            x: p.x,
            y: p.y,
        });

        // Handle each geometry type
        switch (this.#data.type) {
            case GeometryType.LINE: {
                const line = geometry as Line;
                return {
                    start: clonePoint(line.start),
                    end: clonePoint(line.end),
                };
            }
            case GeometryType.ARC: {
                const arc = geometry as Arc;
                return {
                    center: clonePoint(arc.center),
                    radius: arc.radius,
                    startAngle: arc.startAngle,
                    endAngle: arc.endAngle,
                    clockwise: arc.clockwise,
                };
            }
            case GeometryType.CIRCLE: {
                const circle = geometry as Circle;
                return {
                    center: clonePoint(circle.center),
                    radius: circle.radius,
                };
            }
            case GeometryType.ELLIPSE: {
                const ellipse = geometry as Ellipse;
                return {
                    center: clonePoint(ellipse.center),
                    majorAxisEndpoint: clonePoint(ellipse.majorAxisEndpoint),
                    minorToMajorRatio: ellipse.minorToMajorRatio,
                    startParam: ellipse.startParam,
                    endParam: ellipse.endParam,
                };
            }
            case GeometryType.POINT:
                return clonePoint(geometry as PointGeometry);
            case GeometryType.POLYLINE: {
                const polyline = geometry as DxfPolyline;
                return {
                    shapes: polyline.shapes.map((s) =>
                        JSON.parse(JSON.stringify(s))
                    ),
                    closed: polyline.closed,
                };
            }
            case GeometryType.SPLINE: {
                const spline = geometry as Spline;
                return {
                    controlPoints: spline.controlPoints.map(clonePoint),
                    degree: spline.degree,
                    knots: [...spline.knots],
                    weights: [...spline.weights],
                    fitPoints: spline.fitPoints.map(clonePoint),
                    closed: spline.closed,
                };
            }
            default:
                // Fallback: shallow clone with JSON parse/stringify
                return JSON.parse(JSON.stringify(geometry));
        }
    }
}
