// Export interfaces
export type { Polyline, PolylineVertex } from './interfaces';

// Export constants
export { MIN_VERTICES_FOR_POLYLINE } from './constants';

// Export functions
export {
    createPolylineFromVertices,
    getPolylineStartPoint,
    getPolylineEndPoint,
    generateSegments,
    polylineToVertices,
    polylineToPoints,
    reversePolyline,
    getPolylinePointAt,
} from './functions';
