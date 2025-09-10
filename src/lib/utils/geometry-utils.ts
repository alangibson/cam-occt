// Re-export chain/polygon functions from the new location
export {
    WindingDirection,
    calculateSignedArea,
    calculatePolygonArea,
    getWindingDirection,
    isClockwise,
    isCounterClockwise,
    reverseWinding,
    ensureClockwise,
    ensureCounterClockwise,
    calculatePolygonCentroid,
    isSimplePolygon,
    calculatePolygonPerimeter,
} from '$lib/geometry/chain';
