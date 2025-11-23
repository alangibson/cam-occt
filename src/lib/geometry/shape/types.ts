import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { PointGeometry } from '$lib/geometry/point/interfaces';
import type { Polyline } from '$lib/geometry/polyline/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';

export type Geometry =
    | Arc
    | Line
    | Circle
    | Ellipse
    | PointGeometry
    | Polyline
    | Spline;

/**
 * Extract points from a shape for path generation
 * @param shape - The shape to extract points from
 * @param forNativeShapes - If true, avoid tessellation for shapes that support native G-code commands
 */
export type GetShapePointsMode =
    | 'TESSELLATION'
    | 'BOUNDS'
    | 'CHAIN_DETECTION'
    | 'DIRECTION_ANALYSIS';

export type GetShapePointsResolution = 'LOW' | 'MEDIUM' | 'HIGH' | 'ADAPTIVE';
