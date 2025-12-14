<script lang="ts">
    import type { Point2D } from '$lib/geometry/point/interfaces';

    let {
        points,
        unitScale,
        zoomScale,
    }: {
        points: Point2D[];
        unitScale: number;
        zoomScale: number;
    } = $props();
</script>

{#each points as point, i (i)}
    <!-- White border circle -->
    <circle
        cx={point.x}
        cy={point.y}
        r={3.5 / (unitScale * zoomScale)}
        fill="#ffffff"
    />
    <!-- Cyan center circle -->
    <circle
        cx={point.x}
        cy={point.y}
        r={3 / (unitScale * zoomScale)}
        fill="#00ffff"
    />
{/each}
