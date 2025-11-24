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
