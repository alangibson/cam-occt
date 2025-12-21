import type { ChainData } from './interfaces';
import { Shape } from '$lib/cam/shape/classes';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { getArcStartPoint, getArcEndPoint } from '$lib/geometry/arc/functions';
import { calculateSquaredDistance } from '$lib/geometry/math/functions';
import { CONTAINMENT_AREA_TOLERANCE } from '$lib/geometry/constants';
import {
    getChainCentroid,
    getChainPointAt,
    getChainStartPoint,
    getChainEndPoint,
    getChainTangent,
    isChainClosed,
    tessellateChain,
    getChainCutDirection,
} from './functions';
import { CutDirection } from '$lib/cam/cut/enums';
import {
    CHAIN_CLOSURE_TOLERANCE,
    CIRCLE_FIT_EPSILON,
    CYCLIC_CHECK_TOLERANCE,
    MIN_CIRCLE_POINTS,
} from './constants';
import { BoundingBox } from '$lib/geometry/bounding-box/classes';
import { shapesBoundingBox } from '$lib/cam/shape/functions';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import type { Paths64 } from '$lib/wasm/clipper2z';
import { getClipper2 } from '$lib/cam/offset/clipper-init';
import {
    toClipper2Paths,
    calculateClipper2PathsArea,
} from '$lib/cam/offset/convert';
import { isChainContainedInChain_Clipper2 } from './chain-containment';
import type { Geometric } from '$lib/cam/interfaces';

export class Chain implements Geometric, ChainData {
    #data: ChainData;
    #shapes = $state<Shape[]>([]);
    #boundary?: BoundingBox;
    #area?: number;
    #isClosed?: boolean;
    #tessellated?: Polyline;
    #paths64?: Paths64;
    #centroid?: Point2D;
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    #pointAt: Map<number, Point2D> = new Map();
    #startPoint?: Point2D;
    #endPoint?: Point2D;
    #midPoint?: Point2D;
    #tangent?: Point2D;
    #normal?: Point2D;
    #direction?: CutDirection;

    constructor(data: ChainData) {
        this.#data = data;
        // Check if shapes are already Shape instances
        if (
            data.shapes &&
            data.shapes.length > 0 &&
            data.shapes[0] instanceof Shape
        ) {
            this.#shapes = data.shapes as Shape[];
        } else if (data.shapes && data.shapes.length > 0) {
            this.#shapes = data.shapes.map((s) => new Shape(s));
        } else {
            // Handle missing or empty shapes array
            this.#shapes = [];
        }
    }

    get id(): string {
        return this.#data.id;
    }

    get name(): string {
        return this.#data.name;
    }

    get shapes(): Shape[] {
        return this.#shapes;
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
            name: this.name,
            shapes: this.shapes.map((s) => s.toData()),
            clockwise: this.clockwise,
            originalChainId: this.originalChainId,
        };
    }

    /**
     * Get the bounding box for this chain
     * Lazily calculates and caches the bounding box on first access
     *
     * @returns BoundingBox instance for spatial operations
     */
    get boundary(): BoundingBox {
        // TODO use chainBoundingBox(chain) instead?
        if (!this.#boundary) {
            const boundingBoxData = shapesBoundingBox(this.#data.shapes);
            this.#boundary = new BoundingBox(boundingBoxData);
        }
        return this.#boundary;
    }

    /**
     * Get the centroid (center point) of this chain
     * Lazily calculates and caches the result on first access
     * For circles/arcs, returns geometric center
     * For other shapes, calculates polygon centroid
     *
     * @returns The centroid point of the chain
     */
    get centroid(): Point2D {
        if (!this.#centroid) {
            this.#centroid = getChainCentroid(this);
        }
        return this.#centroid;
    }

    /**
     * Get the point at a specific position along the chain
     * Lazily calculates and caches results
     *
     * @param t Parameter value from 0 to 1 (0 = start, 1 = end)
     * @returns Point at the specified position along the chain
     */
    pointAt(t: number): Point2D {
        if (!this.#pointAt.has(t)) {
            this.#pointAt.set(t, getChainPointAt(this, t));
        }

        return this.#pointAt.get(t)!;
    }

    /**
     * Get the start point of this chain
     * Lazily calculates and caches the result on first access
     *
     * @returns The start point of the chain
     */
    get startPoint(): Point2D {
        if (!this.#startPoint) {
            this.#startPoint = getChainStartPoint(this);
        }
        return this.#startPoint;
    }

    /**
     * Get the end point of this chain
     * Lazily calculates and caches the result on first access
     *
     * @returns The end point of the chain
     */
    get endPoint(): Point2D {
        if (!this.#endPoint) {
            this.#endPoint = getChainEndPoint(this);
        }
        return this.#endPoint;
    }

    /**
     * Get the midpoint of this chain (at t=0.5)
     * Lazily calculates and caches the result on first access
     *
     * @returns The midpoint of the chain
     */
    get midPoint(): Point2D {
        if (!this.#midPoint) {
            this.#midPoint = getChainPointAt(this, 0.5);
        }
        return this.#midPoint;
    }

    /**
     * Get the tangent vector at the start of this chain
     * Lazily calculates and caches the result on first access
     *
     * @returns The tangent vector at the start point
     */
    get tangent(): Point2D {
        if (!this.#tangent) {
            this.#tangent = getChainTangent(this, this.startPoint, true);
        }
        return this.#tangent;
    }

    /**
     * Get the normal vector at the start of this chain
     * Lazily calculates and caches the result on first access
     * The normal is perpendicular to the tangent (rotated 90° counterclockwise)
     *
     * @returns The normal vector at the start point
     */
    get normal(): Point2D {
        if (!this.#normal) {
            const t = this.tangent;
            this.#normal = { x: -t.y, y: t.x };
        }
        return this.#normal;
    }

    /**
     * Get the cut direction from chain's stored clockwise property
     * Lazily calculates and caches the result on first access
     *
     * @returns CutDirection based on the chain's clockwise property
     */
    get direction(): CutDirection {
        if (this.#direction === undefined) {
            this.#direction = getChainCutDirection(this);
        }
        return this.#direction;
    }

    /**
     * Check if this chain is closed
     * Lazily calculates and caches the result on first access
     * Uses default tolerance
     *
     * @returns true if the chain is closed, false otherwise
     */
    get isClosed(): boolean {
        if (this.#isClosed === undefined) {
            this.#isClosed = isChainClosed(this, CHAIN_CLOSURE_TOLERANCE);
        }
        return this.#isClosed;
    }

    /**
     * Get tessellated points for this chain
     * Lazily calculates and caches the result on first access
     * Uses default part detection parameters
     *
     * @returns Polyline of tessellated points
     */
    get tessellated(): Polyline {
        if (this.#tessellated === undefined) {
            this.#tessellated = tessellateChain(
                this,
                DEFAULT_PART_DETECTION_PARAMETERS
            );
        }
        return this.#tessellated;
    }

    /**
     * Get Clipper2 Paths64 for this chain
     * Lazily calculates and caches the result on first access
     * Uses tessellated points converted to Clipper2 format
     *
     * @returns Paths64 Clipper2 path representation
     */
    paths64(): Paths64 {
        if (this.#paths64 === undefined) {
            const clipper = getClipper2();
            this.#paths64 = toClipper2Paths([this.tessellated], clipper);
        }
        return this.#paths64;
    }

    /**
     * Get Clipper2 area for this chain
     * Lazily calculates and caches the result on first access
     * Uses Clipper2 path representation for robust area calculation
     *
     * @returns Area in squared units
     */
    area(): number {
        if (this.#area === undefined) {
            const paths = this.paths64();
            this.#area = calculateClipper2PathsArea(paths);
        }
        return this.#area;
    }

    /**
     * Check if this chain contains another chain using Clipper2 geometric containment
     *
     * @param otherChain The chain to check if it's contained within this chain
     * @returns True if otherChain is contained within this chain
     */
    contains(otherChain: Chain): boolean {
        // Do full geometric containment check using Clipper2
        const isContained = isChainContainedInChain_Clipper2(otherChain, this);
        return isContained;
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

    /**
     * Create a deep clone of this chain with a new ID
     * Clones all shapes recursively with geometry deep copied
     * @param preserveShapeIds If true, preserves original shape IDs; if false, generates new IDs for shapes
     * @returns A new Chain instance with cloned data
     */
    clone(preserveShapeIds: boolean = true): Chain {
        return new Chain({
            id: crypto.randomUUID(),
            name: this.#data.name,
            shapes: this.shapes.map((shape) =>
                shape.clone(preserveShapeIds).toData()
            ),
            clockwise: this.#data.clockwise,
            originalChainId: this.#data.originalChainId,
        });
    }

    /**
     * Translate all shapes in this chain by the given offset
     * @param dx X offset to translate by
     * @param dy Y offset to translate by
     */
    translate(dx: number, dy: number): void {
        for (const shape of this.shapes) {
            shape.translate(dx, dy);
        }
        // Clear caches as they're now invalid
        this.#boundary = undefined;
        this.#centroid = undefined;
        this.#pointAt.clear();
        this.#tessellated = undefined;
        this.#paths64 = undefined;
        this.#area = undefined;
        this.#startPoint = undefined;
        this.#endPoint = undefined;
        this.#midPoint = undefined;
        this.#tangent = undefined;
        this.#normal = undefined;
        this.#direction = undefined;
        // Reassign array to trigger Svelte 5 $state reactivity
        this.#shapes = [...this.#shapes];
    }
}
