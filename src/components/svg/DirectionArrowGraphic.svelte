<script lang="ts">
    import type { Point2D } from '$lib/geometry/point/interfaces';

    let {
        midpoint,
        p1,
        p2,
        unitScale,
        zoomScale,
    }: {
        midpoint: Point2D;
        p1: Point2D;
        p2: Point2D;
        unitScale: number;
        zoomScale: number;
    } = $props();

    const dx = $derived(p2.x - p1.x);
    const dy = $derived(p2.y - p1.y);
    const magnitude = $derived(Math.sqrt(dx * dx + dy * dy));
    const dirX = $derived(magnitude > 0 ? dx / magnitude : 0);
    const dirY = $derived(magnitude > 0 ? dy / magnitude : 0);
    const perpX = $derived(-dirY);
    const perpY = $derived(dirX);
    const chevronSize = $derived(8 / (unitScale * zoomScale));
    const wingLength = $derived(chevronSize * 0.7);
    const backOffset = $derived(chevronSize * 0.3);
    const tipOffset = $derived(chevronSize * 0.4);
    const quarterPi = Math.PI / 4;

    const wing1 = $derived({
        x:
            midpoint.x -
            backOffset * dirX +
            wingLength *
                (dirX * Math.cos(quarterPi) + perpX * Math.sin(quarterPi)),
        y:
            midpoint.y -
            backOffset * dirY +
            wingLength *
                (dirY * Math.cos(quarterPi) + perpY * Math.sin(quarterPi)),
    });

    const wing2 = $derived({
        x:
            midpoint.x -
            backOffset * dirX +
            wingLength *
                (dirX * Math.cos(quarterPi) - perpX * Math.sin(quarterPi)),
        y:
            midpoint.y -
            backOffset * dirY +
            wingLength *
                (dirY * Math.cos(quarterPi) - perpY * Math.sin(quarterPi)),
    });

    const tip = $derived({
        x: midpoint.x + tipOffset * dirX,
        y: midpoint.y + tipOffset * dirY,
    });
</script>

{#if magnitude > 0}
    <path
        d="M {wing1.x} {wing1.y} L {tip.x} {tip.y} L {wing2.x} {wing2.y}"
        stroke="rgb(0, 133, 84)"
        stroke-width="1"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
    />
{/if}
