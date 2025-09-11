import type { Shape } from '../shape';

export interface Chain {
    id: string;
    shapes: Shape[];
    clockwise?: boolean | null; // true=clockwise, false=counterclockwise, null=open chain, undefined=not analyzed
}
