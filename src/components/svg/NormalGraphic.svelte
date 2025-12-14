<script lang="ts">
    import type { Point2D } from '$lib/geometry/point/interfaces';

    let {
        startPoint,
        normal,
        unitScale,
        zoomScale,
    }: {
        startPoint: Point2D;
        normal: Point2D;
        unitScale: number;
        zoomScale: number;
    } = $props();

    const normalLength = $derived(20 / (unitScale * zoomScale));
    const endPoint = $derived({
        x: startPoint.x + normal.x * normalLength,
        y: startPoint.y + normal.y * normalLength,
    });

    const strokeColor = 'rgba(0, 150, 255, 0.7)';
</script>

<defs>
    <marker
        id="normal-arrow"
        markerWidth="10"
        markerHeight="10"
        refX="9"
        refY="3"
        orient="auto"
        markerUnits="strokeWidth"
    >
        <path d="M0,0 L0,6 L9,3 z" fill={strokeColor} />
    </marker>
</defs>

<line
    x1={startPoint.x}
    y1={startPoint.y}
    x2={endPoint.x}
    y2={endPoint.y}
    stroke={strokeColor}
    stroke-width="1"
    stroke-dasharray="4,4"
    vector-effect="non-scaling-stroke"
    marker-end="url(#normal-arrow)"
/>
