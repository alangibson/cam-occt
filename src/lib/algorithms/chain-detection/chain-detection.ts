import type {
    Shape,
    Point2D,
    Line,
    Circle,
    Polyline,
    Ellipse,
} from '../../types';
import type { Spline } from '$lib/geometry/spline';
import type { Arc } from '$lib/geometry/arc';
import { GeometryType } from '../../types';
// Unused imports removed to fix lint warnings
import { evaluateNURBS } from '$lib/geometry/spline';
import { polylineToPoints } from '$lib/geometry/polyline';
import { calculateSquaredDistance } from '../../utils/math-utils';
import { isEllipseClosed } from '$lib/geometry/ellipse/index';
import { detectCutDirection } from '../cut-direction';
import { CutDirection } from '../../types/direction';
import { GEOMETRIC_PRECISION_TOLERANCE } from '../../constants';
import { CHAIN_CLOSURE_TOLERANCE } from '$lib/geometry/chain';
import { POLYGON_POINTS_MIN } from '$lib/geometry/chain';

export interface ChainDetectionOptions {
    tolerance: number;
}

export interface Chain {
    id: string;
    shapes: Shape[];
    clockwise?: boolean | null; // true=clockwise, false=counterclockwise, null=open chain, undefined=not analyzed
}

/**
 * Core algorithm to detect chains of shapes based on point overlap within tolerance.
 *
 * A chain is defined as a connected sequence of shapes where:
 * - Some point in shape A overlaps with some point in shape B within the tolerance
 * - The overlap relationship is transitive (A connects to B, B connects to C → A, B, C form a chain)
 * - ALL shapes form chains, including single isolated shapes (both open and closed)
 *
 * Algorithm uses Union-Find (Disjoint Set) data structure for efficient chain detection.
 */
export function detectShapeChains(
    shapes: Shape[],
    options: ChainDetectionOptions = { tolerance: 0.05 }
): Chain[] {
    if (shapes.length === 0) return [];

    const { tolerance }: { tolerance: number } = options;
    const unionFind: UnionFind = new UnionFind(shapes.length);

    // Compare each pair of shapes for connectivity
    for (let i: number = 0; i < shapes.length; i++) {
        for (let j: number = i + 1; j < shapes.length; j++) {
            if (areShapesConnected(shapes[i], shapes[j], tolerance)) {
                unionFind.union(i, j);
            }
        }
    }

    // Group shapes by their root component
    const chainGroups: Map<number, number[]> = new Map<number, number[]>();
    for (let i: number = 0; i < shapes.length; i++) {
        const root: number = unionFind.find(i);
        if (!chainGroups.has(root)) {
            chainGroups.set(root, []);
        }
        chainGroups.get(root)!.push(i);
    }

    // Convert to ShapeChain objects
    const chains: Chain[] = [];
    let chainId: number = 1;

    for (const [, shapeIndices] of chainGroups) {
        if (shapeIndices.length > 1) {
            // Multiple connected shapes form a chain
            chains.push({
                id: `chain-${chainId++}`,
                shapes: shapeIndices.map((index) => shapes[index]),
            });
        } else if (shapeIndices.length === 1) {
            // Single shape - ALL single shapes form chains (both open and closed)
            const singleShape: Shape = shapes[shapeIndices[0]];
            chains.push({
                id: `chain-${chainId++}`,
                shapes: [singleShape],
            });
        }
    }

    return chains;
}

/**
 * Check if two shapes are connected (any point from shape A overlaps with any point from shape B within tolerance)
 */
function areShapesConnected(
    shapeA: Shape,
    shapeB: Shape,
    tolerance: number
): boolean {
    const pointsA: Point2D[] = getShapePoints(shapeA);
    const pointsB: Point2D[] = getShapePoints(shapeB);

    // Check if any point from shape A is within tolerance of any point from shape B
    for (const pointA of pointsA) {
        for (const pointB of pointsB) {
            if (arePointsWithinTolerance(pointA, pointB, tolerance)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if two points are within the specified tolerance distance
 */
function arePointsWithinTolerance(
    pointA: Point2D,
    pointB: Point2D,
    tolerance: number
): boolean {
    const distance: number = Math.sqrt(
        calculateSquaredDistance(pointA, pointB)
    );
    return distance <= tolerance;
}

/**
 * Extract key points from a shape for connectivity analysis
 */
function getShapePoints(shape: Shape): Point2D[] {
    switch (shape.type) {
        case GeometryType.LINE:
            const line: Line = shape.geometry as Line;
            return [line.start, line.end];

        case GeometryType.CIRCLE:
            const circle: Circle = shape.geometry as Circle;
            // For circles, use key points around the circumference
            return [
                { x: circle.center.x + circle.radius, y: circle.center.y }, // Right
                { x: circle.center.x - circle.radius, y: circle.center.y }, // Left
                { x: circle.center.x, y: circle.center.y + circle.radius }, // Top
                { x: circle.center.x, y: circle.center.y - circle.radius }, // Bottom
                circle.center, // Center
            ];

        case GeometryType.ARC:
            const arc: Arc = shape.geometry as Arc;
            const startX: number =
                arc.center.x + arc.radius * Math.cos(arc.startAngle);
            const startY: number =
                arc.center.y + arc.radius * Math.sin(arc.startAngle);
            const endX: number =
                arc.center.x + arc.radius * Math.cos(arc.endAngle);
            const endY: number =
                arc.center.y + arc.radius * Math.sin(arc.endAngle);

            return [
                { x: startX, y: startY }, // Start point
                { x: endX, y: endY }, // End point
                arc.center, // Center
            ];

        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            return polylineToPoints(polyline);

        case GeometryType.SPLINE:
            const spline: Spline = shape.geometry as Spline;

            // For chain detection, start with fit points or control points as fallback
            const points: Point2D[] = [];

            // Use fit points if available (most accurate representation)
            if (spline.fitPoints && spline.fitPoints.length > 0) {
                points.push(...spline.fitPoints);
            } else if (
                spline.controlPoints &&
                spline.controlPoints.length > 0
            ) {
                // Fallback to control points if no fit points
                points.push(...spline.controlPoints);
            }

            return points;

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;

            // Calculate major and minor axis lengths
            const majorAxisLength: number = Math.sqrt(
                ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x +
                    ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
            );
            const minorAxisLength: number =
                majorAxisLength * ellipse.minorToMajorRatio;

            // Calculate rotation angle of major axis
            const majorAxisAngle: number = Math.atan2(
                ellipse.majorAxisEndpoint.y,
                ellipse.majorAxisEndpoint.x
            );

            if (
                typeof ellipse.startParam === 'number' &&
                typeof ellipse.endParam === 'number'
            ) {
                // Ellipse arc - return start and end points
                const startParam: number = ellipse.startParam;
                const endParam: number = ellipse.endParam;

                // Calculate start point
                const startX: number = majorAxisLength * Math.cos(startParam);
                const startY: number = minorAxisLength * Math.sin(startParam);
                const rotatedStartX: number =
                    startX * Math.cos(majorAxisAngle) -
                    startY * Math.sin(majorAxisAngle);
                const rotatedStartY: number =
                    startX * Math.sin(majorAxisAngle) +
                    startY * Math.cos(majorAxisAngle);

                // Calculate end point
                const endX: number = majorAxisLength * Math.cos(endParam);
                const endY: number = minorAxisLength * Math.sin(endParam);
                const rotatedEndX: number =
                    endX * Math.cos(majorAxisAngle) -
                    endY * Math.sin(majorAxisAngle);
                const rotatedEndY: number =
                    endX * Math.sin(majorAxisAngle) +
                    endY * Math.cos(majorAxisAngle);

                return [
                    {
                        x: ellipse.center.x + rotatedStartX,
                        y: ellipse.center.y + rotatedStartY,
                    }, // Start point
                    {
                        x: ellipse.center.x + rotatedEndX,
                        y: ellipse.center.y + rotatedEndY,
                    }, // End point
                    ellipse.center, // Center
                ];
            } else {
                // Full ellipse - return key points around the perimeter
                const points: Point2D[] = [];

                // Sample key points around the ellipse perimeter (0°, 90°, 180°, 270°)
                for (
                    let angle: number = 0;
                    angle < 2 * Math.PI;
                    angle += Math.PI / 2
                ) {
                    const x: number = majorAxisLength * Math.cos(angle);
                    const y: number = minorAxisLength * Math.sin(angle);
                    const rotatedX: number =
                        x * Math.cos(majorAxisAngle) -
                        y * Math.sin(majorAxisAngle);
                    const rotatedY: number =
                        x * Math.sin(majorAxisAngle) +
                        y * Math.cos(majorAxisAngle);

                    points.push({
                        x: ellipse.center.x + rotatedX,
                        y: ellipse.center.y + rotatedY,
                    });
                }

                points.push(ellipse.center); // Add center point
                return points;
            }

        default:
            return [];
    }
}

/**
 * Checks if a single shape forms a closed loop
 */
export function isShapeClosed(shape: Shape, tolerance: number): boolean {
    switch (shape.type) {
        case GeometryType.CIRCLE:
            // Circles are always closed
            return true;

        case GeometryType.POLYLINE:
            const polyline: Polyline = shape.geometry as Polyline;
            const points: Point2D[] = polylineToPoints(polyline);
            if (!points || points.length < POLYGON_POINTS_MIN) return false;

            // CRITICAL FIX: For polylines, first check the explicit closed flag from DXF parsing
            // This is especially important for polylines with bulges where the geometric
            // first/last points don't represent the actual curve endpoints
            if (typeof polyline.closed === 'boolean') {
                return polyline.closed;
            }

            // Fallback: geometric check for polylines without explicit closure information
            const firstPoint: Point2D = points[0];
            const lastPoint: Point2D = points[points.length - 1];

            if (!firstPoint || !lastPoint) return false;

            // Check if first and last points are within tolerance
            const distance: number = Math.sqrt(
                Math.pow(firstPoint.x - lastPoint.x, 2) +
                    Math.pow(firstPoint.y - lastPoint.y, 2)
            );

            return distance <= tolerance;

        case GeometryType.ARC:
            // Arcs are open by definition (unless they're a full circle, but that would be a circle)
            return false;

        case GeometryType.LINE:
            // Lines are open by definition
            return false;

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = shape.geometry as Ellipse;
            // Use the centralized ellipse closed detection logic
            return isEllipseClosed(ellipse, GEOMETRIC_PRECISION_TOLERANCE);

        case GeometryType.SPLINE:
            const splineGeom: Spline = shape.geometry as Spline;

            // For splines, use proper NURBS evaluation to get actual start and end points
            let splineFirstPoint: Point2D | null = null;
            let splineLastPoint: Point2D | null = null;

            try {
                // Use NURBS evaluation for accurate endpoints
                splineFirstPoint = evaluateNURBS(0, splineGeom);
                splineLastPoint = evaluateNURBS(1, splineGeom);
            } catch {
                // Fallback to fit points if NURBS evaluation fails
                if (splineGeom.fitPoints && splineGeom.fitPoints.length > 0) {
                    splineFirstPoint = splineGeom.fitPoints[0];
                    splineLastPoint =
                        splineGeom.fitPoints[splineGeom.fitPoints.length - 1];
                } else if (
                    splineGeom.controlPoints &&
                    splineGeom.controlPoints.length > 0
                ) {
                    // Final fallback to control points
                    splineFirstPoint = splineGeom.controlPoints[0];
                    splineLastPoint =
                        splineGeom.controlPoints[
                            splineGeom.controlPoints.length - 1
                        ];
                }
            }

            if (!splineFirstPoint || !splineLastPoint) return false;

            // Check if first and last points are within tolerance
            const splineDistance: number = Math.sqrt(
                Math.pow(splineFirstPoint.x - splineLastPoint.x, 2) +
                    Math.pow(splineFirstPoint.y - splineLastPoint.y, 2)
            );

            return splineDistance <= tolerance;

        default:
            throw new Error(`Unknown type ${shape.type}`);
    }
}

/**
 * Union-Find (Disjoint Set) data structure for efficient connected component detection
 */
class UnionFind {
    private parent: number[];
    private rank: number[];

    constructor(size: number) {
        this.parent = Array.from({ length: size }, (_, i) => i);
        this.rank = new Array(size).fill(0);
    }

    find(x: number): number {
        if (this.parent[x] !== x) {
            this.parent[x] = this.find(this.parent[x]); // Path compression
        }
        return this.parent[x];
    }

    union(x: number, y: number): boolean {
        const rootX: number = this.find(x);
        const rootY: number = this.find(y);

        if (rootX === rootY) return false; // Already in same set

        // Union by rank for optimal performance
        if (this.rank[rootX] < this.rank[rootY]) {
            this.parent[rootX] = rootY;
        } else if (this.rank[rootX] > this.rank[rootY]) {
            this.parent[rootY] = rootX;
        } else {
            this.parent[rootY] = rootX;
            this.rank[rootX]++;
        }

        return true;
    }
}

/**
 * Analyze and set the clockwise property for a chain.
 * This should be called once during the Prepare stage when chains are first created.
 *
 * @param chain - The chain to analyze
 * @param tolerance - Tolerance for determining if chain is closed
 * @returns The chain with clockwise property set
 */
export function setChainDirection(
    chain: Chain,
    tolerance: number = CHAIN_CLOSURE_TOLERANCE
): Chain {
    const direction = detectCutDirection(chain, tolerance);

    return {
        ...chain,
        clockwise:
            direction === CutDirection.CLOCKWISE
                ? true
                : direction === CutDirection.COUNTERCLOCKWISE
                  ? false
                  : null,
    };
}

/**
 * Analyze and set clockwise properties for multiple chains.
 *
 * @param chains - Array of chains to analyze
 * @param tolerance - Tolerance for determining if chains are closed
 * @returns Array of chains with clockwise properties set
 */
export function setChainsDirection(
    chains: Chain[],
    tolerance: number = CHAIN_CLOSURE_TOLERANCE
): Chain[] {
    return chains.map((chain) => setChainDirection(chain, tolerance));
}
