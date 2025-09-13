import type { Arc } from '../arc';
import type { Circle } from '../circle';
import type { Ellipse } from '../ellipse';
import type { Line } from '../line';
import type { Polyline } from '../polyline';
import type { Spline } from '../spline';

export type Geometry = Arc | Line | Circle | Ellipse | Polyline | Spline;
