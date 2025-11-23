import type { ChainData } from './interfaces';
import { Shape } from '$lib/geometry/shape/classes';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import { GeometryType } from '$lib/geometry/shape/enums';
import { getArcStartPoint, getArcEndPoint } from '$lib/geometry/arc/functions';
import { calculateSquaredDistance } from '$lib/geometry/math/functions';
import { CONTAINMENT_AREA_TOLERANCE } from '$lib/geometry/constants';
import { getChainCentroid } from './functions';

// Minimum number of points required to define a circle
const MIN_CIRCLE_POINTS = 3;
// Tolerance for matrix determinant in circle fitting
const CIRCLE_FIT_EPSILON = 1e-10;
// Tolerance for checking if points lie on a circle (in drawing units)
// More relaxed than CONTAINMENT_AREA_TOLERANCE to account for numerical precision
const CYCLIC_CHECK_TOLERANCE = 0.01;

export class Chain implements ChainData {
    #data: ChainData;
    #shapesCache?: Shape[];

    constructor(data: ChainData) {
        this.#data = data;
    }

    get id(): string {
        return this.#data.id;
    }

    get shapes(): Shape[] {
        if (!this.#shapesCache) {
            this.#shapesCache = this.#data.shapes.map((s) => new Shape(s));
        }
        return this.#shapesCache;
    }

    get clockwise(): boolean | null | undefined {
        return this.#data.clockwise;
    }

    get originalChainId(): string | undefined {
        return this.#data.originalChainId;
    }

    toData(): ChainData {
        return {
            id: this.id,
            shapes: this.shapes.map((s) => s.toData()),
            clockwise: this.clockwise,
            originalChainId: this.originalChainId,
        };
    }

    /**
     * Get the center point (centroid) of this chain
     * For circles/arcs, returns geometric center
     * For other shapes, calculates polygon centroid
     *
     * @returns The center point of the chain
     */
    centerPoint(): Point2D {
        return getChainCentroid(this.#data);
    }

    /**
     * Check if all points in the chain lie on a circle.
     * Returns true when:
     * 1. Chain contains a single circle
     * 2. Chain contains multiple arcs that form a circle (same center and radius)
     * 3. Chain forms a cyclic polygon (all vertices lie on a circumscribed circle)
     *
     * @returns true if the chain is cyclic, false otherwise
     */
    isCyclic(): boolean {
        if (this.shapes.length === 0) {
            return false;
        }

        // Case 1: Single circle
        if (
            this.shapes.length === 1 &&
            this.shapes[0].type === GeometryType.CIRCLE
        ) {
            return true;
        }

        // Case 2: Multiple arcs forming a circle
        const allArcs = this.shapes.every((s) => s.type === GeometryType.ARC);
        if (allArcs && this.shapes.length > 0) {
            const firstArc = this.shapes[0].geometry as Arc;
            const sameCircle = this.shapes.every((s) => {
                const arc = s.geometry as Arc;
                return (
                    Math.abs(arc.center.x - firstArc.center.x) <
                        CONTAINMENT_AREA_TOLERANCE &&
                    Math.abs(arc.center.y - firstArc.center.y) <
                        CONTAINMENT_AREA_TOLERANCE &&
                    Math.abs(arc.radius - firstArc.radius) <
                        CONTAINMENT_AREA_TOLERANCE
                );
            });
            if (sameCircle) {
                return true;
            }
        }

        // Case 3: Cyclic polygon - collect all vertices (excluding arc/circle centers)
        const vertices: Point2D[] = [];

        for (const shape of this.shapes) {
            switch (shape.type) {
                case GeometryType.LINE: {
                    const line = shape.geometry as {
                        start: Point2D;
                        end: Point2D;
                    };
                    vertices.push(line.start, line.end);
                    break;
                }
                case GeometryType.ARC: {
                    const arc = shape.geometry as Arc;
                    vertices.push(getArcStartPoint(arc), getArcEndPoint(arc));
                    break;
                }
                case GeometryType.CIRCLE: {
                    // Circle doesn't contribute vertices for cyclic polygon check
                    // A single circle is already handled above
                    return false;
                }
                case GeometryType.POLYLINE: {
                    // Use tessellation to get vertices from polyline
                    const points = shape.tessellation.points;
                    vertices.push(...points);
                    break;
                }
                case GeometryType.SPLINE: {
                    // Use tessellation to get points from spline
                    const points = shape.tessellation.points;
                    vertices.push(...points);
                    break;
                }
                case GeometryType.ELLIPSE: {
                    // Use tessellation to get points from ellipse
                    const points = shape.tessellation.points;
                    vertices.push(...points);
                    break;
                }
            }
        }

        // Remove duplicate consecutive vertices
        const uniqueVertices: Point2D[] = [];
        for (const vertex of vertices) {
            const lastVertex = uniqueVertices[uniqueVertices.length - 1];
            if (
                !lastVertex ||
                Math.abs(vertex.x - lastVertex.x) >
                    CONTAINMENT_AREA_TOLERANCE ||
                Math.abs(vertex.y - lastVertex.y) > CONTAINMENT_AREA_TOLERANCE
            ) {
                uniqueVertices.push(vertex);
            }
        }

        // Need at least MIN_CIRCLE_POINTS points for a circle
        if (uniqueVertices.length < MIN_CIRCLE_POINTS) {
            return false;
        }

        // Fit a circle to the vertices using least squares
        const circleCenter = this.#fitCircle(uniqueVertices);
        if (!circleCenter) {
            return false;
        }

        // Check if all vertices lie on the fitted circle
        const radius = Math.sqrt(
            calculateSquaredDistance(circleCenter, uniqueVertices[0])
        );

        for (const vertex of uniqueVertices) {
            const dist = Math.sqrt(
                calculateSquaredDistance(circleCenter, vertex)
            );
            if (Math.abs(dist - radius) > CYCLIC_CHECK_TOLERANCE) {
                return false;
            }
        }

        return true;
    }

    /**
     * Fit a circle to a set of points using least squares.
     * Uses the simplified algebraic fit method.
     *
     * @param points Array of points to fit
     * @returns Center of the fitted circle, or null if fitting fails
     */
    #fitCircle(points: Point2D[]): Point2D | null {
        if (points.length < MIN_CIRCLE_POINTS) {
            return null;
        }

        // Calculate means
        let sumX = 0,
            sumY = 0;
        for (const p of points) {
            sumX += p.x;
            sumY += p.y;
        }
        const n = points.length;
        const meanX = sumX / n;
        const meanY = sumY / n;

        // Build system of equations for circle fitting
        // We solve: [Suu Suv] [uc]   [Suuu + Suvv]
        //           [Suv Svv] [vc] = [Svvv + Svuu]
        // where u = x - meanX, v = y - meanY
        // and (uc, vc) is the center offset from the mean

        let Suu = 0,
            Suv = 0,
            Svv = 0;
        let Suuu = 0,
            Svvv = 0,
            Suvv = 0,
            Svuu = 0;

        for (const p of points) {
            const u = p.x - meanX;
            const v = p.y - meanY;
            const u2 = u * u;
            const v2 = v * v;

            Suu += u2;
            Suv += u * v;
            Svv += v2;
            Suuu += u2 * u;
            Svvv += v2 * v;
            Suvv += u * v2;
            Svuu += v * u2;
        }

        // Solve the 2x2 system
        const det = Suu * Svv - Suv * Suv;
        if (Math.abs(det) < CIRCLE_FIT_EPSILON) {
            return null; // Singular matrix - points are collinear
        }

        const rhs1 = (Suuu + Suvv) / 2;
        const rhs2 = (Svvv + Svuu) / 2;

        const uc = (rhs1 * Svv - rhs2 * Suv) / det;
        const vc = (Suu * rhs2 - Suv * rhs1) / det;

        // Convert back to original coordinates
        const cx = uc + meanX;
        const cy = vc + meanY;

        return { x: cx, y: cy };
    }
}
