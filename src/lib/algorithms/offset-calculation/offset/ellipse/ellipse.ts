import verb from 'verb-nurbs';
import { EPSILON } from '$lib/geometry/math/constants';
import {
    type Ellipse,
    GeometryType,
    type Point2D,
    type Shape,
} from '$lib/types/geometry';
import type { Spline } from '$lib/geometry/spline';
import { POLYGON_POINTS_MIN } from '$lib/geometry/chain';
import {
    DEFAULT_SPLINE_DEGREE,
    generateUniformKnotVector,
} from '$lib/geometry/spline';
import { getEllipseParameters } from '$lib/geometry/ellipse/index';
import {
    OffsetDirection,
    type OffsetResult,
} from '$lib/algorithms/offset-calculation/offset/types';

/**
 * Offset an ellipse using true mathematical ellipse offset calculation
 * Based on reference/cam/offset/ellipse/ellipse_offset.md
 *
 * The true offset of an ellipse is NOT another ellipse, but a complex curve.
 * We calculate the true offset points using the unit normal vector method.
 */
export function offsetEllipse(
    ellipse: Ellipse,
    distance: number,
    direction: OffsetDirection
): OffsetResult {
    if (direction === 'none' || distance === 0) {
        return {
            success: true,
            shapes: [],
            warnings: [],
            errors: [],
        };
    }

    try {
        // Calculate major and minor axis lengths and rotation angle
        const {
            majorAxisLength,
            minorAxisLength,
            majorAxisAngle: rotationAngle,
        } = getEllipseParameters(ellipse);

        // Handle ellipse arcs vs full ellipses
        const startParam: number = ellipse.startParam || 0;
        const endParam: number = ellipse.endParam || 2 * Math.PI;
        const paramRange: number = endParam - startParam;
        const isFullEllipse: boolean =
            Math.abs(paramRange - 2 * Math.PI) < EPSILON;

        // Apply direction: outset = positive offset, inset = negative offset
        const offsetDistance: number =
            direction === 'outset' ? distance : -distance;

        // Generate offset points using true mathematical offset
        // Use reasonable resolution for stable NURBS fitting
        const numPoints: number = 100; // Balanced resolution for smooth curves without overly complex knot vectors
        const points: Point2D[] = [];

        for (let i: number = 0; i < numPoints; i++) {
            const t: number = startParam + (i / (numPoints - 1)) * paramRange;
            const cosT: number = Math.cos(t);
            const sinT: number = Math.sin(t);

            // Point on the original ellipse (before rotation and translation)
            const ellipseX: number = majorAxisLength * cosT;
            const ellipseY: number = minorAxisLength * sinT;

            // Normal vector components (before rotation)
            // For an ellipse x²/a² + y²/b² = 1, the normal at parameter t is (a*cos(t), b*sin(t))
            const normalX: number = majorAxisLength * cosT;
            const normalY: number = minorAxisLength * sinT;
            const magnitude: number = Math.sqrt(
                normalX * normalX + normalY * normalY
            );

            if (magnitude === 0) continue;

            // Unit normal vector
            const unitNormalX: number = normalX / magnitude;
            const unitNormalY: number = normalY / magnitude;

            // Calculate offset point (before rotation and translation)
            const offsetX: number = ellipseX + offsetDistance * unitNormalX;
            const offsetY: number = ellipseY + offsetDistance * unitNormalY;

            // Apply rotation
            const rotatedX: number =
                offsetX * Math.cos(rotationAngle) -
                offsetY * Math.sin(rotationAngle);
            const rotatedY: number =
                offsetX * Math.sin(rotationAngle) +
                offsetY * Math.cos(rotationAngle);

            // Translate to ellipse center
            points.push({
                x: ellipse.center.x + rotatedX,
                y: ellipse.center.y + rotatedY,
            });
        }

        if (points.length < POLYGON_POINTS_MIN) {
            return {
                success: false,
                shapes: [],
                warnings: [],
                errors: ['Insufficient points generated for ellipse offset'],
            };
        }

        // Convert offset points to 3D for verb-nurbs
        const offsetPoints3D: [number, number, number][] = points.map((p) => [
            p.x,
            p.y,
            0,
        ]);

        // Fit NURBS curve through the offset points
        const degree: number = Math.min(
            DEFAULT_SPLINE_DEGREE,
            offsetPoints3D.length - 1
        ); // Use cubic or lower based on point count
        let offsetCurve: verb.geom.NurbsCurve;

        try {
            offsetCurve = verb.geom.NurbsCurve.byPoints(offsetPoints3D, degree);
        } catch (error) {
            return {
                success: false,
                shapes: [],
                warnings: [],
                errors: [
                    `Failed to fit NURBS curve to ellipse offset points: ${error instanceof Error ? (error as Error).message : String(error)}`,
                ],
            };
        }

        // Convert verb curve back to our Spline format
        const controlPoints2D: Point2D[] = offsetCurve
            .controlPoints()
            .map((p) => ({
                x: p[0],
                y: p[1],
            }));

        const curveDegree: number = offsetCurve.degree();
        const knots: number[] = offsetCurve.knots();
        const weights: number[] = offsetCurve.weights();
        const expectedKnots: number = controlPoints2D.length + curveDegree + 1;

        let validatedKnots: number[] = knots;

        // Validate and repair knot vector if necessary
        if (knots.length !== expectedKnots) {
            console.warn(
                `Ellipse offset: Knot vector mismatch: got ${knots.length}, expected ${expectedKnots}`
            );
            console.warn(
                `Control points: ${controlPoints2D.length}, degree: ${curveDegree}`
            );

            // Generate a valid uniform knot vector
            const validKnots = generateUniformKnotVector(
                controlPoints2D.length,
                curveDegree
            );

            console.warn(
                `Using generated uniform knot vector of length ${validKnots.length}`
            );
            validatedKnots = validKnots;
        } else {
            // Validate knot vector structure (should start and end with degree+1 repeats)
            const firstKnot: number = knots[0];
            const lastKnot: number = knots[knots.length - 1];

            let needsRepair: boolean = false;

            // Check if first degree+1 knots are all the same
            for (let i: number = 0; i <= curveDegree; i++) {
                if (Math.abs(knots[i] - firstKnot) > EPSILON) {
                    needsRepair = true;
                    break;
                }
            }

            // Check if last degree+1 knots are all the same
            if (!needsRepair) {
                for (
                    let i: number = knots.length - curveDegree - 1;
                    i < knots.length;
                    i++
                ) {
                    if (Math.abs(knots[i] - lastKnot) > EPSILON) {
                        needsRepair = true;
                        break;
                    }
                }
            }

            if (needsRepair) {
                console.warn(
                    'Ellipse offset: Knot vector structure invalid, generating uniform knot vector'
                );

                // Generate a valid uniform knot vector
                validatedKnots = generateUniformKnotVector(
                    controlPoints2D.length,
                    curveDegree
                );
            }
        }

        const splineGeometry: Spline = {
            controlPoints: controlPoints2D,
            knots: validatedKnots,
            weights: weights,
            degree: curveDegree,
            fitPoints: [], // verb-nurbs doesn't preserve fit points
            closed: isFullEllipse,
        };

        // Create the offset shape as a spline
        const offsetShape: Shape = {
            // eslint-disable-next-line no-magic-numbers
            id: `offset_${Math.random().toString(36).substr(2, 9)}`,
            type: GeometryType.SPLINE,
            geometry: splineGeometry,
        };

        return {
            success: true,
            shapes: [offsetShape],
            warnings: [
                'Ellipse offset calculated using true mathematical offset and fitted to NURBS curve',
            ],
            errors: [],
        };
    } catch (error) {
        return {
            success: false,
            shapes: [],
            warnings: [],
            errors: [
                `Failed to offset ellipse: ${error instanceof Error ? (error as Error).message : String(error)}`,
            ],
        };
    }
}
