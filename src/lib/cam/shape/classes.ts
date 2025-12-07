import type { ShapeData, TessellationCache } from './interfaces';
import { hashShape, tessellateShape, translateShape } from './functions';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import type { Geometry } from '$lib/geometry/types';
import { GeometryType } from '$lib/geometry/enums';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { PointGeometry } from '$lib/geometry/point/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';

export class Shape implements ShapeData {
    #data: ShapeData;
    #tessellationCache?: TessellationCache;

    constructor(data: ShapeData) {
        if (!data.id) {
            console.error('Shape constructor called with invalid data:', data);
        }
        this.#data = data;
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

    translate(dx: number, dy: number): void {
        translateShape(this, dx, dy);
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
