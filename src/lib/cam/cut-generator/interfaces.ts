import type { Point2D } from '$lib/geometry/point';
import type { Shape } from '$lib/geometry/shape';
import type { NormalSide } from '$lib/cam/cut/enums';
import type { CuttingParameters } from '$lib/cam/gcode-generator/interfaces';
import type { Lead } from './types';

export interface CutPath {
    id: string;
    shapeId: string;
    points: Point2D[];
    leadIn?: Lead;
    leadOut?: Lead;
    isRapid: boolean;
    parameters?: CuttingParameters;
    originalShape?: Shape; // Preserve original shape for native G-code generation
    executionClockwise?: boolean | null; // Execution direction from cut (true=CW, false=CCW, null=no direction)
    normalSide?: NormalSide; // Which side the normal is on (for machine cutter compensation)
    hasOffset?: boolean; // Whether this cut has an offset applied
}
