/**
 * Calculate parameter position on polyline from segment index and segment parameter
 */
export function calculatePolylineParameter(
    segmentIndex: number,
    segmentParam: number,
    totalSegments: number
): number {
    // Simple approach: distribute parameters evenly across segments
    const baseParam: number = segmentIndex / totalSegments;
    const segmentLength: number = 1.0 / totalSegments;
    return baseParam + segmentParam * segmentLength;
}
