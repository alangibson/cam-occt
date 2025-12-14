<script lang="ts">
    import type { Point2D } from '$lib/geometry/point/interfaces';

    let {
        point,
        tangent,
        unitScale,
        zoomScale,
    }: {
        point: Point2D;
        tangent: Point2D;
        unitScale: number;
        zoomScale: number;
    } = $props();

    const magnitude = $derived(
        Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y)
    );
    const normalizedTangent = $derived(
        magnitude > 0
            ? { x: tangent.x / magnitude, y: tangent.y / magnitude }
            : null
    );
    const tangentLength = $derived(50 / (unitScale * zoomScale));
    const lineStart = $derived(
        normalizedTangent
            ? {
                  x: point.x - normalizedTangent.x * tangentLength,
                  y: point.y - normalizedTangent.y * tangentLength,
              }
            : null
    );
    const lineEnd = $derived(
        normalizedTangent
            ? {
                  x: point.x + normalizedTangent.x * tangentLength,
                  y: point.y + normalizedTangent.y * tangentLength,
              }
            : null
    );
</script>

{#if lineStart && lineEnd}
    <line
        x1={lineStart.x}
        y1={lineStart.y}
        x2={lineEnd.x}
        y2={lineEnd.y}
        stroke="#ffff00"
        stroke-width="1"
        vector-effect="non-scaling-stroke"
    />
{/if}
