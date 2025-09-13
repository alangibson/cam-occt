// Public API exports for shape system
export { GeometryType } from './enums';
export type { Shape, Layer, Drawing } from './interfaces';
export type { Geometry } from './types';
export {
    getShapePoints,
    tessellateShape,
    type GetShapePointsMode,
    type GetShapePointsResolution,
    type GetShapePointsOptions,
} from './functions';
