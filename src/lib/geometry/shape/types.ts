import type { Arc } from '$lib/geometry/arc';
import type { Circle } from '$lib/geometry/circle';
import type { Ellipse } from '$lib/geometry/ellipse';
import type { Line } from '$lib/geometry/line';
import type { Polyline } from '$lib/geometry/polyline';
import type { Spline } from '$lib/geometry/spline';

export type Geometry = Arc | Line | Circle | Ellipse | Polyline | Spline;
