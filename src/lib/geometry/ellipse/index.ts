// Re-export interfaces and types
export type { Ellipse, EllipseTessellationConfig } from './interfaces';

// Re-export constants
export {
    ELLIPSE_TESSELLATION_POINTS,
    MIN_TESSELLATION_POINTS,
    MAX_TESSELLATION_POINTS,
} from './constants';

// Re-export functions
export {
    calculateEllipsePoint,
    calculateEllipsePointWithRotation,
    generateEllipsePoints,
    tessellateEllipse,
    tessellateEllipseWithConfig,
    evaluateEllipseAtParameter,
    getEllipseStartEndPoints,
    getEllipseParameters,
    isFullEllipse,
    isEllipseClosed,
    distanceFromEllipsePerimeter,
    getEllipseStartPoint,
    getEllipseEndPoint,
    reverseEllipse,
    getEllipsePointAt,
    getEllipseRadiusX,
    getEllipseRadiusY,
    getEllipseRotation,
    calculateEllipseArcLength,
    createAdaptiveTessellationConfig,
    validateEllipseGeometry,
} from './functions';
