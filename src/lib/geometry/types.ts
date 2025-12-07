import type { Arc } from '$lib/geometry/arc/interfaces';
import type { Circle } from '$lib/geometry/circle/interfaces';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { Line } from '$lib/geometry/line/interfaces';
import type { PointGeometry } from '$lib/geometry/point/interfaces';
import type { DxfPolyline } from '$lib/geometry/dxf-polyline/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';

export type Geometry =
    | Arc
    | Line
    | Circle
    | Ellipse
    | PointGeometry
    | DxfPolyline
    | Spline;
