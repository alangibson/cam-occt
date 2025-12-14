<script lang="ts">
    import type { Point2D } from '$lib/geometry/point/interfaces';

    let {
        point,
        unitScale,
        zoomScale,
    }: {
        point: Point2D;
        unitScale: number;
        zoomScale: number;
    } = $props();
</script>

<circle
    cx={point.x}
    cy={point.y}
    r={4 / (unitScale * zoomScale)}
    fill="rgb(0, 133, 84)"
/>
