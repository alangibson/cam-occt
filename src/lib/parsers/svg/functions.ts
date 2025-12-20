import { SVGPathData } from 'svg-pathdata';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { Unit } from '$lib/config/units/units';
import { generateId } from '$lib/domain/id';
import {
    DEFAULT_LAYER_NAME,
    COORDS_PER_POINT,
    MIN_POLYLINE_COORDS,
    ARC_RADIUS_TOLERANCE,
    ARC_POINT_TOLERANCE,
    DEGREES_TO_RADIANS,
    ARC_CENTER_SIGN,
    ELLIPTICAL_ARC_SEGMENTS,
} from './constants';
import type { Point2D } from '$lib/geometry/point/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';

const DEFAULT_FALLBACK_HEIGHT = 100;
const VIEWBOX_PARTS_COUNT = 4;

/**
 * Simple SVG parser using DOMParser
 */
function parseSVGContent(content: string): Document {
    if (typeof DOMParser === 'undefined') {
        // Node.js environment - use jsdom
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM(content, { contentType: 'image/svg+xml' });
        return dom.window.document;
    }
    // Browser environment
    const parser = new DOMParser();
    return parser.parseFromString(content, 'image/svg+xml');
}

/**
 * Convert SVG line element to ShapeData
 */
function convertLineElement(
    element: Element,
    layer: string,
    svgHeight: number
): ShapeData | null {
    const x1 = parseFloat(element.getAttribute('x1') || '0');
    const y1 = parseFloat(element.getAttribute('y1') || '0');
    const x2 = parseFloat(element.getAttribute('x2') || '0');
    const y2 = parseFloat(element.getAttribute('y2') || '0');

    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
        return null;
    }

    return {
        id: generateId(),
        type: GeometryType.LINE,
        geometry: {
            start: { x: x1, y: flipY(y1, svgHeight) },
            end: { x: x2, y: flipY(y2, svgHeight) },
        },
        layer,
    };
}

/**
 * Convert SVG circle element to ShapeData
 */
function convertCircleElement(
    element: Element,
    layer: string,
    svgHeight: number
): ShapeData | null {
    const cx = parseFloat(element.getAttribute('cx') || '0');
    const cy = parseFloat(element.getAttribute('cy') || '0');
    const r = parseFloat(element.getAttribute('r') || '0');

    if (!isFinite(cx) || !isFinite(cy) || !isFinite(r) || r <= 0) {
        return null;
    }

    return {
        id: generateId(),
        type: GeometryType.CIRCLE,
        geometry: {
            center: { x: cx, y: flipY(cy, svgHeight) },
            radius: r,
        },
        layer,
    };
}

/**
 * Convert SVG ellipse element to ShapeData
 */
function convertEllipseElement(
    element: Element,
    layer: string,
    svgHeight: number
): ShapeData | null {
    const cx = parseFloat(element.getAttribute('cx') || '0');
    const cy = parseFloat(element.getAttribute('cy') || '0');
    const rx = parseFloat(element.getAttribute('rx') || '0');
    const ry = parseFloat(element.getAttribute('ry') || '0');

    if (
        !isFinite(cx) ||
        !isFinite(cy) ||
        !isFinite(rx) ||
        !isFinite(ry) ||
        rx <= 0 ||
        ry <= 0
    ) {
        return null;
    }

    // Determine which is the major axis
    const isMajorX = rx >= ry;
    const majorRadius = isMajorX ? rx : ry;
    const minorRadius = isMajorX ? ry : rx;
    const ratio = minorRadius / majorRadius;

    // Major axis endpoint is relative to center
    const majorAxisEndpoint = isMajorX
        ? { x: majorRadius, y: 0 }
        : { x: 0, y: majorRadius };

    return {
        id: generateId(),
        type: GeometryType.ELLIPSE,
        geometry: {
            center: { x: cx, y: flipY(cy, svgHeight) },
            majorAxisEndpoint,
            minorToMajorRatio: ratio,
            startParam: 0,
            endParam: Math.PI * 2,
        },
        layer,
    };
}

/**
 * Convert SVG rect element to closed polyline ShapeData
 */
function convertRectElement(
    element: Element,
    layer: string,
    svgHeight: number
): ShapeData | null {
    const x = parseFloat(element.getAttribute('x') || '0');
    const y = parseFloat(element.getAttribute('y') || '0');
    const width = parseFloat(element.getAttribute('width') || '0');
    const height = parseFloat(element.getAttribute('height') || '0');

    if (
        !isFinite(x) ||
        !isFinite(y) ||
        !isFinite(width) ||
        !isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {
        return null;
    }

    // Flip Y coordinates: rect top-left is (x, y) in SVG, becomes (x, svgHeight-y) in CAD
    const y1 = flipY(y, svgHeight);
    const y2 = flipY(y + height, svgHeight);

    // Create four lines forming a rectangle
    const lines: ShapeData[] = [
        {
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x, y: y1 },
                end: { x: x + width, y: y1 },
            },
            layer,
        },
        {
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x: x + width, y: y1 },
                end: { x: x + width, y: y2 },
            },
            layer,
        },
        {
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x: x + width, y: y2 },
                end: { x, y: y2 },
            },
            layer,
        },
        {
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x, y: y2 },
                end: { x, y: y1 },
            },
            layer,
        },
    ];

    return {
        id: generateId(),
        type: GeometryType.POLYLINE,
        geometry: {
            closed: true,
            shapes: lines,
        },
        layer,
    };
}

/**
 * Convert SVG polyline/polygon element to ShapeData
 */
function convertPolylineElement(
    element: Element,
    layer: string,
    closed: boolean,
    svgHeight: number
): ShapeData | null {
    const pointsStr = element.getAttribute('points');
    if (!pointsStr) {
        return null;
    }

    // Parse points: "x1,y1 x2,y2 x3,y3" or "x1 y1 x2 y2"
    const coords = pointsStr
        .trim()
        .split(/[\s,]+/)
        .map((s) => parseFloat(s))
        .filter((n) => isFinite(n));

    if (coords.length < MIN_POLYLINE_COORDS) {
        // Need at least 2 points (4 coordinates)
        return null;
    }

    const points: Point2D[] = [];
    for (let i = 0; i < coords.length; i += COORDS_PER_POINT) {
        if (i + 1 < coords.length) {
            points.push({ x: coords[i], y: flipY(coords[i + 1], svgHeight) });
        }
    }

    if (points.length < 2) {
        return null;
    }

    // Convert points to line segments
    const shapes: ShapeData[] = [];
    for (let i = 0; i < points.length - 1; i++) {
        shapes.push({
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: points[i],
                end: points[i + 1],
            },
            layer,
        });
    }

    // Close the polygon if needed
    if (closed && points.length > 2) {
        shapes.push({
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: points[points.length - 1],
                end: points[0],
            },
            layer,
        });
    }

    return {
        id: generateId(),
        type: GeometryType.POLYLINE,
        geometry: {
            closed,
            shapes,
        },
        layer,
    };
}

/**
 * Reflect control point for smooth Bézier curves
 * If lastControlPoint exists, reflect it across currentPoint
 * Otherwise, return currentPoint
 */
function reflectControlPoint(
    currentPoint: Point2D,
    lastControlPoint: Point2D | null
): Point2D {
    if (!lastControlPoint) {
        return { ...currentPoint };
    }
    return {
        x: 2 * currentPoint.x - lastControlPoint.x,
        y: 2 * currentPoint.y - lastControlPoint.y,
    };
}

/**
 * SVG Transform interface
 */
interface SVGTransform {
    tx: number; // translate X
    ty: number; // translate Y
    sx: number; // scale X
    sy: number; // scale Y
}

/**
 * Parse SVG transform attribute into transform object
 * Supports translate, scale, and matrix transforms
 */
function parseTransformAttr(transformAttr: string | null): SVGTransform {
    if (!transformAttr) {
        return { tx: 0, ty: 0, sx: 1, sy: 1 };
    }

    let translateX = 0;
    let translateY = 0;
    let scaleX = 1;
    let scaleY = 1;

    // Parse matrix transform: matrix(a b c d e f)
    const matrixMatch = transformAttr.match(
        /matrix\s*\(\s*([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s]+)[\s,]+([^,\s)]+)\s*\)/
    );
    if (matrixMatch) {
        const a = parseFloat(matrixMatch[1]) || 0;
        const d = parseFloat(matrixMatch[4]) || 0;
        const e = parseFloat(matrixMatch[5]) || 0;
        const f = parseFloat(matrixMatch[6]) || 0;

        scaleX = a;
        scaleY = d;
        translateX = e;
        translateY = f;

        return { tx: translateX, ty: translateY, sx: scaleX, sy: scaleY };
    }

    // Parse translate: translate(x [y])
    const translateMatch = transformAttr.match(
        /translate\s*\(\s*([^,\s]+)[\s,]*([^)]*)\)/
    );
    if (translateMatch) {
        translateX = parseFloat(translateMatch[1]) || 0;
        translateY = parseFloat(translateMatch[2]) || 0;
    }

    // Parse scale: scale(x [y])
    const scaleMatch = transformAttr.match(
        /scale\s*\(\s*([^,\s]+)[\s,]*([^)]*)\)/
    );
    if (scaleMatch) {
        scaleX = parseFloat(scaleMatch[1]) || 1;
        scaleY = parseFloat(scaleMatch[2]) || scaleX;
    }

    return { tx: translateX, ty: translateY, sx: scaleX, sy: scaleY };
}

/**
 * Get cumulative transform for an element including all ancestors
 */
function getCumulativeTransform(element: Element): SVGTransform {
    const transform: SVGTransform = { tx: 0, ty: 0, sx: 1, sy: 1 };
    let current: Element | null = element;

    while (current && current.getAttribute) {
        const elementTransform = parseTransformAttr(
            current.getAttribute('transform')
        );

        // Combine transforms (apply current transform to accumulated transform)
        transform.tx = transform.tx * elementTransform.sx + elementTransform.tx;
        transform.ty = transform.ty * elementTransform.sy + elementTransform.ty;
        transform.sx *= elementTransform.sx;
        transform.sy *= elementTransform.sy;

        current = current.parentElement;
    }

    return transform;
}

/**
 * Apply transform to a point
 * Transforms are applied AFTER Y-flip in shape conversion
 * Transform translation values are in SVG space and must be flipped too
 */
function transformPoint(
    point: Point2D,
    transform: SVGTransform,
    svgHeight: number
): Point2D {
    // Transform Y-translation needs to be flipped from SVG space to CAD space
    const flippedTy = svgHeight - transform.ty - svgHeight; // = -transform.ty

    return {
        x: point.x * transform.sx + transform.tx,
        y: point.y * transform.sy + flippedTy,
    };
}

/**
 * Apply transform to a shape's geometry
 */
function applyTransformToShape(
    shape: ShapeData,
    transform: SVGTransform,
    svgHeight: number
): ShapeData {
    // Skip if no transform
    if (
        transform.tx === 0 &&
        transform.ty === 0 &&
        transform.sx === 1 &&
        transform.sy === 1
    ) {
        return shape;
    }

    const { geometry } = shape;

    switch (shape.type) {
        case GeometryType.LINE: {
            const line = geometry as Line;
            return {
                ...shape,
                geometry: {
                    start: transformPoint(line.start, transform, svgHeight),
                    end: transformPoint(line.end, transform, svgHeight),
                },
            };
        }

        case GeometryType.CIRCLE: {
            const circle = geometry as Circle;
            return {
                ...shape,
                geometry: {
                    center: transformPoint(circle.center, transform, svgHeight),
                    radius: circle.radius * transform.sx, // Assume uniform scale
                },
            };
        }

        case GeometryType.ARC: {
            const arc = geometry as Arc;
            return {
                ...shape,
                geometry: {
                    center: transformPoint(arc.center, transform, svgHeight),
                    radius: arc.radius * transform.sx,
                    startAngle: arc.startAngle,
                    endAngle: arc.endAngle,
                    clockwise: arc.clockwise,
                },
            };
        }

        case GeometryType.ELLIPSE: {
            const ellipse = geometry as Ellipse;
            return {
                ...shape,
                geometry: {
                    center: transformPoint(
                        ellipse.center,
                        transform,
                        svgHeight
                    ),
                    majorAxisEndpoint: {
                        x: ellipse.majorAxisEndpoint.x * transform.sx,
                        y: ellipse.majorAxisEndpoint.y * transform.sy,
                    },
                    minorToMajorRatio: ellipse.minorToMajorRatio,
                    startParam: ellipse.startParam,
                    endParam: ellipse.endParam,
                },
            };
        }

        case GeometryType.SPLINE: {
            const spline = geometry as Spline;
            return {
                ...shape,
                geometry: {
                    ...spline,
                    controlPoints: spline.controlPoints.map((pt: Point2D) =>
                        transformPoint(pt, transform, svgHeight)
                    ),
                    fitPoints: spline.fitPoints.map((pt: Point2D) =>
                        transformPoint(pt, transform, svgHeight)
                    ),
                },
            };
        }

        case GeometryType.POLYLINE: {
            // SVG polylines have closed: boolean and shapes: ShapeData[]
            const polyline = geometry as {
                closed: boolean;
                shapes: ShapeData[];
            };
            return {
                ...shape,
                geometry: {
                    ...polyline,
                    shapes: polyline.shapes.map((s: ShapeData) =>
                        applyTransformToShape(s, transform, svgHeight)
                    ),
                },
            };
        }

        default:
            return shape;
    }
}

/**
 * Convert SVG path element to ShapeData array
 * Handles all SVG path commands including curves and arcs
 */
function convertPathElement(
    element: Element,
    layer: string,
    svgHeight: number
): ShapeData[] {
    const d = element.getAttribute('d');
    if (!d) {
        return [];
    }

    try {
        const pathData = new SVGPathData(d);
        const commands = pathData.commands;

        if (commands.length === 0) {
            return [];
        }

        const shapes: ShapeData[] = [];
        // Initialize currentPoint to SVG origin in CAD space (Y-flipped)
        let currentPoint: Point2D = { x: 0, y: 0 };
        let startPoint: Point2D = { x: 0, y: 0 };
        let lastControlPoint: Point2D | null = null; // For smooth curves

        for (let i = 0; i < commands.length; i++) {
            const cmd = commands[i];

            switch (cmd.type) {
                case SVGPathData.MOVE_TO: {
                    const { x, y, relative } = cmd;
                    currentPoint = relative
                        ? { x: currentPoint.x + x, y: currentPoint.y - y }
                        : { x, y: flipY(y, svgHeight) };
                    startPoint = { ...currentPoint };
                    lastControlPoint = null;
                    break;
                }

                case SVGPathData.LINE_TO: {
                    const { x, y, relative } = cmd;
                    const endPoint = relative
                        ? { x: currentPoint.x + x, y: currentPoint.y - y }
                        : { x, y: flipY(y, svgHeight) };
                    shapes.push({
                        id: generateId(),
                        type: GeometryType.LINE,
                        geometry: {
                            start: { ...currentPoint },
                            end: endPoint,
                        },
                        layer,
                    });
                    currentPoint = endPoint;
                    lastControlPoint = null;
                    break;
                }

                case SVGPathData.HORIZ_LINE_TO: {
                    const { x, relative } = cmd;
                    const endX = relative ? currentPoint.x + x : x;
                    shapes.push({
                        id: generateId(),
                        type: GeometryType.LINE,
                        geometry: {
                            start: { ...currentPoint },
                            end: { x: endX, y: currentPoint.y },
                        },
                        layer,
                    });
                    currentPoint = { x: endX, y: currentPoint.y };
                    lastControlPoint = null;
                    break;
                }

                case SVGPathData.VERT_LINE_TO: {
                    const { y, relative } = cmd;
                    const endY = relative
                        ? currentPoint.y - y
                        : flipY(y, svgHeight);
                    shapes.push({
                        id: generateId(),
                        type: GeometryType.LINE,
                        geometry: {
                            start: { ...currentPoint },
                            end: {
                                x: currentPoint.x,
                                y: endY,
                            },
                        },
                        layer,
                    });
                    currentPoint = { x: currentPoint.x, y: endY };
                    lastControlPoint = null;
                    break;
                }

                case SVGPathData.CLOSE_PATH:
                    if (
                        currentPoint.x !== startPoint.x ||
                        currentPoint.y !== startPoint.y
                    ) {
                        shapes.push({
                            id: generateId(),
                            type: GeometryType.LINE,
                            geometry: {
                                start: { ...currentPoint },
                                end: { ...startPoint },
                            },
                            layer,
                        });
                    }
                    currentPoint = { ...startPoint };
                    lastControlPoint = null;
                    break;

                case SVGPathData.ARC: {
                    // Handle elliptical arc
                    const {
                        rX,
                        rY,
                        xRot,
                        lArcFlag,
                        sweepFlag,
                        x,
                        y,
                        relative,
                    } = cmd;

                    // Convert relative coordinates to absolute (with Y-flip)
                    const endPoint: Point2D = relative
                        ? { x: currentPoint.x + x, y: currentPoint.y - y } // Relative Y is inverted
                        : { x, y: flipY(y, svgHeight) };

                    // Check if it's a circular arc (rX == rY)
                    if (Math.abs(rX - rY) < ARC_RADIUS_TOLERANCE) {
                        // Circular arc - convert to ARC geometry
                        // Calculate center and angles using SVG arc parameterization
                        const arcData = convertSVGArcToCenter(
                            currentPoint,
                            endPoint,
                            rX,
                            rY,
                            xRot,
                            lArcFlag,
                            sweepFlag
                        );

                        if (arcData) {
                            shapes.push({
                                id: generateId(),
                                type: GeometryType.ARC,
                                geometry: {
                                    center: arcData.center,
                                    radius: rX,
                                    startAngle: arcData.startAngle,
                                    endAngle: arcData.endAngle,
                                    clockwise: sweepFlag === 0,
                                },
                                layer,
                            });
                        }
                    } else {
                        // Elliptical arc - convert to ELLIPSE geometry
                        // For now, tessellate to line segments as approximation
                        // TODO: Implement proper ellipse arc support
                        const tessellatedPoints = tessellateEllipticalArc(
                            currentPoint,
                            endPoint,
                            rX,
                            rY,
                            xRot,
                            lArcFlag,
                            sweepFlag
                        );

                        for (let j = 0; j < tessellatedPoints.length - 1; j++) {
                            shapes.push({
                                id: generateId(),
                                type: GeometryType.LINE,
                                geometry: {
                                    start: tessellatedPoints[j],
                                    end: tessellatedPoints[j + 1],
                                },
                                layer,
                            });
                        }
                    }

                    currentPoint = endPoint;
                    lastControlPoint = null;
                    break;
                }

                case SVGPathData.CURVE_TO: {
                    // Cubic Bézier curve (degree 3, 4 control points)
                    const { x1, y1, x2, y2, x, y, relative } = cmd;

                    // Convert relative coordinates to absolute (with Y-flip)
                    const cp1 = relative
                        ? { x: currentPoint.x + x1, y: currentPoint.y - y1 }
                        : { x: x1, y: flipY(y1, svgHeight) };
                    const cp2 = relative
                        ? { x: currentPoint.x + x2, y: currentPoint.y - y2 }
                        : { x: x2, y: flipY(y2, svgHeight) };
                    const end = relative
                        ? { x: currentPoint.x + x, y: currentPoint.y - y }
                        : { x, y: flipY(y, svgHeight) };

                    shapes.push({
                        id: generateId(),
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [{ ...currentPoint }, cp1, cp2, end],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1], // Uniform knot vector for cubic Bézier
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer,
                    });

                    lastControlPoint = cp2;
                    currentPoint = end;
                    break;
                }

                case SVGPathData.SMOOTH_CURVE_TO: {
                    // Smooth cubic Bézier - reflect last control point
                    const { x2, y2, x, y, relative } = cmd;

                    // Convert relative coordinates to absolute (with Y-flip)
                    const cp2 = relative
                        ? { x: currentPoint.x + x2, y: currentPoint.y - y2 }
                        : { x: x2, y: flipY(y2, svgHeight) };
                    const end = relative
                        ? { x: currentPoint.x + x, y: currentPoint.y - y }
                        : { x, y: flipY(y, svgHeight) };

                    const reflectedCP = reflectControlPoint(
                        currentPoint,
                        lastControlPoint
                    );

                    shapes.push({
                        id: generateId(),
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { ...currentPoint },
                                reflectedCP,
                                cp2,
                                end,
                            ],
                            knots: [0, 0, 0, 0, 1, 1, 1, 1],
                            weights: [1, 1, 1, 1],
                            degree: 3,
                            fitPoints: [],
                            closed: false,
                        },
                        layer,
                    });

                    lastControlPoint = cp2;
                    currentPoint = end;
                    break;
                }

                case SVGPathData.QUAD_TO: {
                    // Quadratic Bézier curve (degree 2, 3 control points)
                    const { x1, y1, x, y, relative } = cmd;

                    // Convert relative coordinates to absolute (with Y-flip)
                    const cp = relative
                        ? { x: currentPoint.x + x1, y: currentPoint.y - y1 }
                        : { x: x1, y: flipY(y1, svgHeight) };
                    const end = relative
                        ? { x: currentPoint.x + x, y: currentPoint.y - y }
                        : { x, y: flipY(y, svgHeight) };

                    shapes.push({
                        id: generateId(),
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [{ ...currentPoint }, cp, end],
                            knots: [0, 0, 0, 1, 1, 1], // Uniform knot vector for quadratic Bézier
                            weights: [1, 1, 1],
                            degree: 2,
                            fitPoints: [],
                            closed: false,
                        },
                        layer,
                    });

                    lastControlPoint = cp;
                    currentPoint = end;
                    break;
                }

                case SVGPathData.SMOOTH_QUAD_TO: {
                    // Smooth quadratic Bézier - reflect last control point
                    const { x, y, relative } = cmd;

                    // Convert relative coordinates to absolute (with Y-flip)
                    const end = relative
                        ? { x: currentPoint.x + x, y: currentPoint.y - y }
                        : { x, y: flipY(y, svgHeight) };

                    const reflectedCP = reflectControlPoint(
                        currentPoint,
                        lastControlPoint
                    );

                    shapes.push({
                        id: generateId(),
                        type: GeometryType.SPLINE,
                        geometry: {
                            controlPoints: [
                                { ...currentPoint },
                                reflectedCP,
                                end,
                            ],
                            knots: [0, 0, 0, 1, 1, 1],
                            weights: [1, 1, 1],
                            degree: 2,
                            fitPoints: [],
                            closed: false,
                        },
                        layer,
                    });

                    lastControlPoint = reflectedCP;
                    currentPoint = end;
                    break;
                }

                default:
                    lastControlPoint = null;
                    break;
            }
        }

        return shapes;
    } catch (error) {
        console.error('Failed to parse SVG path:', error);
        return [];
    }
}

/**
 * Convert SVG arc parameterization to center parameterization
 * Based on SVG spec: https://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes
 */
function convertSVGArcToCenter(
    start: Point2D,
    end: Point2D,
    rX: number,
    rY: number,
    xRot: number,
    lArcFlag: number,
    sweepFlag: number
): { center: Point2D; startAngle: number; endAngle: number } | null {
    // If start and end points are the same, no arc
    if (
        Math.abs(start.x - end.x) < ARC_POINT_TOLERANCE &&
        Math.abs(start.y - end.y) < ARC_POINT_TOLERANCE
    ) {
        return null;
    }

    // Convert rotation to radians
    const phi = (xRot * Math.PI) / DEGREES_TO_RADIANS;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);

    // Step 1: Compute center point
    const dx = (start.x - end.x) / 2;
    const dy = (start.y - end.y) / 2;
    const x1Prime = cosPhi * dx + sinPhi * dy;
    const y1Prime = -sinPhi * dx + cosPhi * dy;

    // Correct radii if needed
    const lambda =
        (x1Prime * x1Prime) / (rX * rX) + (y1Prime * y1Prime) / (rY * rY);
    if (lambda > 1) {
        rX *= Math.sqrt(lambda);
        rY *= Math.sqrt(lambda);
    }

    // Compute center
    const sq =
        (rX * rX * rY * rY -
            rX * rX * y1Prime * y1Prime -
            rY * rY * x1Prime * x1Prime) /
        (rX * rX * y1Prime * y1Prime + rY * rY * x1Prime * x1Prime);
    const sign = lArcFlag === sweepFlag ? ARC_CENTER_SIGN : 1;
    const cPrime = sign * Math.sqrt(Math.max(0, sq));
    const cxPrime = (cPrime * rX * y1Prime) / rY;
    const cyPrime = (-cPrime * rY * x1Prime) / rX;

    const cx = cosPhi * cxPrime - sinPhi * cyPrime + (start.x + end.x) / 2;
    const cy = sinPhi * cxPrime + cosPhi * cyPrime + (start.y + end.y) / 2;

    // Step 2: Compute angles
    const theta1 = Math.atan2(
        (y1Prime - cyPrime) / rY,
        (x1Prime - cxPrime) / rX
    );
    const dTheta =
        Math.atan2((-y1Prime - cyPrime) / rY, (-x1Prime - cxPrime) / rX) -
        theta1;

    return {
        center: { x: cx, y: cy },
        startAngle: theta1,
        endAngle: theta1 + dTheta,
    };
}

/**
 * Tessellate elliptical arc into line segments
 * Simple approximation using 32 segments per arc
 */
function tessellateEllipticalArc(
    start: Point2D,
    end: Point2D,
    _rX: number,
    _rY: number,
    _xRot: number,
    _lArcFlag: number,
    _sweepFlag: number
): Point2D[] {
    const points: Point2D[] = [start];
    const numSegments = ELLIPTICAL_ARC_SEGMENTS;

    // Use svg-pathdata's built-in arc to curve conversion would be better
    // For now, simple linear interpolation
    for (let i = 1; i <= numSegments; i++) {
        const t = i / numSegments;
        points.push({
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t,
        });
    }

    return points;
}

/**
 * Convert SVG element to ShapeData
 */
function convertSVGElement(
    element: Element,
    layer: string,
    svgHeight: number
): ShapeData | ShapeData[] | null {
    const tagName = element.tagName.toLowerCase();

    let result: ShapeData | ShapeData[] | null = null;

    switch (tagName) {
        case 'line':
            result = convertLineElement(element, layer, svgHeight);
            break;

        case 'circle':
            result = convertCircleElement(element, layer, svgHeight);
            break;

        case 'ellipse':
            result = convertEllipseElement(element, layer, svgHeight);
            break;

        case 'rect':
            result = convertRectElement(element, layer, svgHeight);
            break;

        case 'polyline':
            result = convertPolylineElement(element, layer, false, svgHeight);
            break;

        case 'polygon':
            result = convertPolylineElement(element, layer, true, svgHeight);
            break;

        case 'path':
            result = convertPathElement(element, layer, svgHeight);
            break;

        default:
            return null;
    }

    // Apply cumulative transform if shape was created
    if (result) {
        const transform = getCumulativeTransform(element);
        if (Array.isArray(result)) {
            result = result.map((shape) =>
                applyTransformToShape(shape, transform, svgHeight)
            );
        } else {
            result = applyTransformToShape(result, transform, svgHeight);
        }
    }

    return result;
}

/**
 * Process SVG group element and extract shapes with layer information
 */
function processGroup(
    group: Element,
    layerName: string,
    shapes: ShapeData[],
    svgHeight: number
): void {
    const children = group.children;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const tagName = child.tagName.toLowerCase();

        if (tagName === 'g') {
            // Nested group - use its id as layer name if available
            const nestedLayerName = child.getAttribute('id') || layerName;
            processGroup(child, nestedLayerName, shapes, svgHeight);
        } else {
            // Try to convert element to shape
            const result = convertSVGElement(child, layerName, svgHeight);
            if (result) {
                if (Array.isArray(result)) {
                    shapes.push(...result);
                } else {
                    shapes.push(result);
                }
            }
        }
    }
}

/**
 * Calculate bounding box height from SVG content
 * Scans all numeric values in path data and element attributes to find max Y
 */
function calculateBoundingBoxHeight(svg: Element): number {
    let maxY = 0;

    // Helper to extract Y coordinates from various SVG elements
    const processElement = (el: Element) => {
        const tagName = el.tagName.toLowerCase();

        // Extract Y values based on element type
        switch (tagName) {
            case 'line':
                maxY = Math.max(
                    maxY,
                    parseFloat(el.getAttribute('y1') || '0'),
                    parseFloat(el.getAttribute('y2') || '0')
                );
                break;
            case 'circle':
            case 'ellipse':
                const cy = parseFloat(el.getAttribute('cy') || '0');
                const ry = parseFloat(
                    el.getAttribute('ry') || el.getAttribute('r') || '0'
                );
                maxY = Math.max(maxY, cy + ry);
                break;
            case 'rect':
                const y = parseFloat(el.getAttribute('y') || '0');
                const h = parseFloat(el.getAttribute('height') || '0');
                maxY = Math.max(maxY, y + h);
                break;
            case 'polyline':
            case 'polygon':
                const points = el.getAttribute('points');
                if (points) {
                    const coords = points
                        .trim()
                        .split(/[\s,]+/)
                        .map((s) => parseFloat(s))
                        .filter((n) => isFinite(n));
                    for (let i = 1; i < coords.length; i += 2) {
                        maxY = Math.max(maxY, coords[i]);
                    }
                }
                break;
            case 'path':
                // Parse path d attribute to find Y coordinates
                const d = el.getAttribute('d');
                if (d) {
                    // Simple regex to find all numbers after Y/y commands or coordinates
                    const nums = d.match(/-?\d+\.?\d*/g);
                    if (nums) {
                        nums.forEach((n) => {
                            const val = parseFloat(n);
                            if (isFinite(val))
                                maxY = Math.max(maxY, Math.abs(val));
                        });
                    }
                }
                break;
        }

        // Recursively process child elements
        for (let i = 0; i < el.children.length; i++) {
            processElement(el.children[i]);
        }
    };

    processElement(svg);
    return maxY > 0 ? maxY : DEFAULT_FALLBACK_HEIGHT;
}

/**
 * Extract SVG viewport height for Y-axis flipping
 * SVG uses Y-down (screen coords), but CAD uses Y-up (world coords)
 */
function getSVGHeight(svg: Element): number {
    // Try viewBox first
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
        const parts = viewBox.trim().split(/\s+/);
        if (parts.length === VIEWBOX_PARTS_COUNT) {
            const height = parseFloat(parts[3]);
            if (isFinite(height) && height > 0) {
                return height;
            }
        }
    }

    // Fall back to height attribute
    const heightAttr = svg.getAttribute('height');
    if (heightAttr) {
        const height = parseFloat(heightAttr);
        if (isFinite(height) && height > 0) {
            return height;
        }
    }

    // Last resort: calculate from bounding box
    console.warn(
        'SVG has no viewBox or height attribute, calculating from bounding box'
    );
    return calculateBoundingBoxHeight(svg);
}

/**
 * Flip Y coordinate from SVG convention (Y-down) to CAD convention (Y-up)
 */
function flipY(y: number, height: number): number {
    return height - y;
}

/**
 * Parse SVG content and return DrawingData
 */
export async function parseSVG(content: string): Promise<DrawingData> {
    try {
        const doc = parseSVGContent(content);

        // Check for parsing errors
        const parserError = doc.querySelector('parsererror');
        if (parserError) {
            throw new Error('SVG parsing failed: invalid XML');
        }

        const svg = doc.querySelector('svg');
        if (!svg) {
            throw new Error('No SVG element found in content');
        }

        // Get SVG height for Y-axis flipping
        const svgHeight = getSVGHeight(svg);

        const shapes: ShapeData[] = [];

        // Process all children of the SVG element
        const children = svg.children;
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const tagName = child.tagName.toLowerCase();

            if (tagName === 'g') {
                // Group element - use its id as layer name
                const layerName =
                    child.getAttribute('id') || DEFAULT_LAYER_NAME;
                processGroup(child, layerName, shapes, svgHeight);
            } else {
                // Non-group element - assign to default layer
                const result = convertSVGElement(
                    child,
                    DEFAULT_LAYER_NAME,
                    svgHeight
                );
                if (result) {
                    if (Array.isArray(result)) {
                        shapes.push(...result);
                    } else {
                        shapes.push(result);
                    }
                }
            }
        }

        return {
            shapes,
            units: Unit.NONE, // SVG typically uses unitless coordinates
            fileName: String(Date.now()),
        };
    } catch (error) {
        throw new Error(
            `SVG parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}
