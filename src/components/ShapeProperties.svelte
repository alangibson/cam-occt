<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store';
    import { type Shape, GeometryType } from '$lib/geometry/shape';
    import type { Point2D } from '$lib/geometry/point';
    import type { Line } from '$lib/geometry/line';
    import type { Arc } from '$lib/geometry/arc';
    import type { Circle } from '$lib/geometry/circle';
    import type { Polyline } from '$lib/geometry/polyline';
    import type { Ellipse } from '$lib/geometry/ellipse';
    import type { Spline } from '$lib/geometry/spline';
    import {
        getShapeStartPoint,
        getShapeEndPoint,
    } from '$lib/geometry/shape/functions';
    import { polylineToPoints } from '$lib/geometry/polyline';

    $: drawing = $drawingStore.drawing;
    $: selectedShapes = $drawingStore.selectedShapes;
    $: hoveredShape = $drawingStore.hoveredShape;
    $: selectedOffsetShape = $drawingStore.selectedOffsetShape;

    // Get the shape to display - prioritize offset shape, then selected shape, then hovered
    $: displayShape = selectedOffsetShape
        ? selectedOffsetShape
        : drawing && selectedShapes.size > 0
          ? drawing.shapes.find((shape) => selectedShapes.has(shape.id))
          : drawing && hoveredShape
            ? drawing.shapes.find((shape) => shape.id === hoveredShape)
            : null;

    // Determine display type
    $: isShowingOffset =
        displayShape === selectedOffsetShape && selectedOffsetShape !== null;
    $: isShowingHovered =
        !isShowingOffset &&
        displayShape &&
        selectedShapes.size === 0 &&
        hoveredShape === displayShape?.id;

    function getShapeOrigin(shape: Shape): Point2D {
        switch (shape.type) {
            case GeometryType.LINE:
                const line = shape.geometry as Line;
                return line.start; // Origin is the start point

            case GeometryType.CIRCLE:
            case GeometryType.ARC:
                const circle = shape.geometry as Circle;
                return circle.center; // Origin is the center

            case GeometryType.POLYLINE:
                const polyline = shape.geometry as Polyline;
                const points = polylineToPoints(polyline);
                return points.length > 0 ? points[0] : { x: 0, y: 0 }; // Origin is the first point

            case GeometryType.ELLIPSE:
                const ellipse = shape.geometry as Ellipse;
                return ellipse.center; // Origin is the center

            default:
                return { x: 0, y: 0 };
        }
    }

    function formatPoint(point: Point2D): string {
        return `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
    }

    function getShapeTypeDisplay(shape: Shape): string {
        if (shape.originalType) {
            return `${shape.originalType.toUpperCase()} (${shape.type})`;
        }
        return shape.type.toUpperCase();
    }

    async function copyShapeToClipboard() {
        if (!displayShape) return;

        try {
            const json = JSON.stringify(displayShape, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }

    // Helper function to calculate a point on an ellipse at a given parameter
    // Uses the ezdxf approach: calculating minor axis using counterclockwise perpendicular
    function _getEllipsePointAtParameter(
        ellipse: {
            center: Point2D;
            majorAxisEndpoint: Point2D;
            minorToMajorRatio: number;
        },
        parameter: number
    ): Point2D {
        // IMPORTANT: majorAxisEndpoint is already a VECTOR from center, not an absolute point!
        // This is how DXF stores ellipse data (group codes 11,21,31)
        const majorAxisVector = ellipse.majorAxisEndpoint;

        // Calculate major axis length (this is the semi-major axis length)
        const majorAxisLength = Math.sqrt(
            majorAxisVector.x * majorAxisVector.x +
                majorAxisVector.y * majorAxisVector.y
        );

        // Calculate minor axis length (this is the semi-minor axis length)
        const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;

        // Calculate unit vectors
        const majorAxisUnit = {
            x: majorAxisVector.x / majorAxisLength,
            y: majorAxisVector.y / majorAxisLength,
        };

        // Minor axis is perpendicular to major axis (counterclockwise rotation)
        // This is equivalent to the 2D cross product: z_axis × major_axis (right-hand rule)
        const minorAxisUnit = {
            x: -majorAxisUnit.y, // counterclockwise perpendicular
            y: majorAxisUnit.x,
        };

        // Calculate point using parametric ellipse equation from ezdxf
        const cosParam = Math.cos(parameter);
        const sinParam = Math.sin(parameter);

        const x =
            cosParam * majorAxisLength * majorAxisUnit.x +
            sinParam * minorAxisLength * minorAxisUnit.x;
        const y =
            cosParam * majorAxisLength * majorAxisUnit.y +
            sinParam * minorAxisLength * minorAxisUnit.y;

        // Translate to ellipse center
        return {
            x: ellipse.center.x + x,
            y: ellipse.center.y + y,
        };
    }
</script>

<div class="shape-properties">
    {#if displayShape}
        <div class="property-group">
            <div class="property-row">
                <span class="property-label">Name:</span>
                <span class="property-value">{displayShape.id}</span>
            </div>

            <div class="property-row">
                <span class="property-label">Type:</span>
                <span class="property-value"
                    >{getShapeTypeDisplay(displayShape)}</span
                >
            </div>

            {#if displayShape.layer}
                <div class="property-row">
                    <span class="property-label">Layer:</span>
                    <span class="property-value">{displayShape.layer}</span>
                </div>
            {/if}

            <div class="property-row">
                <span class="property-label">Origin:</span>
                <span class="property-value"
                    >{formatPoint(getShapeOrigin(displayShape))}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">Start:</span>
                <span class="property-value"
                    >{formatPoint(getShapeStartPoint(displayShape))}</span
                >
            </div>

            <div class="property-row">
                <span class="property-label">End:</span>
                <span class="property-value"
                    >{formatPoint(getShapeEndPoint(displayShape))}</span
                >
            </div>

            {#if displayShape.type === GeometryType.CIRCLE || displayShape.type === GeometryType.ARC}
                {@const geometry = displayShape.geometry as Circle | Arc}
                <div class="property-row">
                    <span class="property-label">Radius:</span>
                    <span class="property-value"
                        >{geometry.radius.toFixed(2)}</span
                    >
                </div>

                {#if displayShape.type === GeometryType.ARC}
                    {@const arcGeometry = displayShape.geometry as Arc}
                    <div class="property-row">
                        <span class="property-label">Start Angle:</span>
                        <span class="property-value"
                            >{(
                                (arcGeometry.startAngle * 180) /
                                Math.PI
                            ).toFixed(1)}°</span
                        >
                    </div>
                    <div class="property-row">
                        <span class="property-label">End Angle:</span>
                        <span class="property-value"
                            >{((arcGeometry.endAngle * 180) / Math.PI).toFixed(
                                1
                            )}°</span
                        >
                    </div>
                    <div class="property-row">
                        <span class="property-label">Direction:</span>
                        <span class="property-value"
                            >{arcGeometry.clockwise
                                ? 'Clockwise'
                                : 'Counter-clockwise'}</span
                        >
                    </div>
                {/if}
            {/if}

            {#if displayShape.type === GeometryType.ELLIPSE}
                {@const ellipseGeometry = displayShape.geometry as Ellipse}
                <div class="property-row">
                    <span class="property-label">Center:</span>
                    <span class="property-value"
                        >{formatPoint(ellipseGeometry.center)}</span
                    >
                </div>
                <div class="property-row">
                    <span class="property-label">Major Axis End:</span>
                    <span class="property-value"
                        >{formatPoint(ellipseGeometry.majorAxisEndpoint)}</span
                    >
                </div>
                <div class="property-row">
                    <span class="property-label">Minor/Major Ratio:</span>
                    <span class="property-value"
                        >{ellipseGeometry.minorToMajorRatio.toFixed(3)}</span
                    >
                </div>

                {#if ellipseGeometry.startParam !== undefined && ellipseGeometry.endParam !== undefined}
                    <div class="property-row">
                        <span class="property-label">Start Param:</span>
                        <span class="property-value"
                            >{ellipseGeometry.startParam.toFixed(3)}</span
                        >
                    </div>
                    <div class="property-row">
                        <span class="property-label">End Param:</span>
                        <span class="property-value"
                            >{ellipseGeometry.endParam.toFixed(3)}</span
                        >
                    </div>
                    <div class="property-row">
                        <span class="property-label">Direction:</span>
                        <span class="property-value">Counter-clockwise</span>
                    </div>
                {/if}
            {/if}

            {#if displayShape.type === GeometryType.SPLINE}
                {@const splineGeometry = displayShape.geometry as Spline}
                <div class="property-row">
                    <span class="property-label">Degree:</span>
                    <span class="property-value">{splineGeometry.degree}</span>
                </div>

                {#if splineGeometry.controlPoints && splineGeometry.controlPoints.length > 0}
                    <div class="property-row">
                        <span class="property-label">Control Points:</span>
                        <span class="property-value"
                            >{splineGeometry.controlPoints.length}</span
                        >
                    </div>
                    <div class="spline-points">
                        {#each splineGeometry.controlPoints.slice(0, 5) as point, index (index)}
                            <div class="property-row small">
                                <span class="property-label">
                                    CP {index + 1}:</span
                                >
                                <span class="property-value"
                                    >({point.x.toFixed(2)}, {point.y.toFixed(
                                        2
                                    )})</span
                                >
                            </div>
                        {/each}
                        {#if splineGeometry.controlPoints.length > 5}
                            <div class="property-row small">
                                <span class="property-label"> ...</span>
                                <span class="property-value"
                                    >+{splineGeometry.controlPoints.length - 5} more</span
                                >
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if splineGeometry.knots && splineGeometry.knots.length > 0}
                    <div class="property-row">
                        <span class="property-label">Knots:</span>
                        <span class="property-value"
                            >{splineGeometry.knots.length}</span
                        >
                    </div>
                    <div class="spline-knots">
                        {#each splineGeometry.knots.slice(0, 10) as knot, index (index)}
                            <div class="property-row small">
                                <span class="property-label">
                                    K {index + 1}:</span
                                >
                                <span class="property-value"
                                    >{knot.toFixed(3)}</span
                                >
                            </div>
                        {/each}
                        {#if splineGeometry.knots.length > 10}
                            <div class="property-row small">
                                <span class="property-label"> ...</span>
                                <span class="property-value"
                                    >+{splineGeometry.knots.length - 10} more</span
                                >
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if splineGeometry.weights && splineGeometry.weights.length > 0}
                    <div class="property-row">
                        <span class="property-label">Weights:</span>
                        <span class="property-value"
                            >{splineGeometry.weights.length}</span
                        >
                    </div>
                    <div class="spline-weights">
                        {#each splineGeometry.weights.slice(0, 10) as weight, index (index)}
                            <div class="property-row small">
                                <span class="property-label">
                                    W {index + 1}:</span
                                >
                                <span class="property-value"
                                    >{weight.toFixed(3)}</span
                                >
                            </div>
                        {/each}
                        {#if splineGeometry.weights.length > 10}
                            <div class="property-row small">
                                <span class="property-label"> ...</span>
                                <span class="property-value"
                                    >+{splineGeometry.weights.length - 10} more</span
                                >
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if splineGeometry.fitPoints && splineGeometry.fitPoints.length > 0}
                    <div class="property-row">
                        <span class="property-label">Fit Points:</span>
                        <span class="property-value"
                            >{splineGeometry.fitPoints.length}</span
                        >
                    </div>
                {/if}

                <div class="property-row">
                    <span class="property-label">Closed:</span>
                    <span class="property-value"
                        >{splineGeometry.closed ? 'Yes' : 'No'}</span
                    >
                </div>
            {/if}
        </div>

        {#if isShowingOffset}
            <p class="offset-info">Showing offset shape</p>
        {:else if isShowingHovered}
            <p class="hover-info">Showing hovered shape (click to select)</p>
        {:else if selectedShapes.size > 1}
            <p class="multi-selection">
                {selectedShapes.size} shapes selected (showing first)
            </p>
        {/if}

        <div class="button-row">
            <button
                class="copy-button"
                onclick={copyShapeToClipboard}
                title="Copy shape JSON to clipboard"
            >
                Copy
            </button>
        </div>
    {/if}
</div>

<style>
    .shape-properties {
        min-height: 200px;
    }

    .button-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
    }

    .copy-button {
        padding: 0.25rem 0.75rem;
        background-color: #fff;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .copy-button:hover {
        background-color: #f9fafb;
        border-color: #9ca3af;
    }

    .copy-button:active {
        background-color: #f3f4f6;
    }

    /* h3 header removed - title now handled by AccordionPanel */

    .property-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .property-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.25rem 0;
        min-width: 0;
    }

    .property-row.small {
        padding: 0.125rem 0;
        font-size: 0.9rem;
        margin-left: 0.5rem;
    }

    .spline-points,
    .spline-knots,
    .spline-weights {
        margin-top: 0.5rem;
    }

    .property-label {
        font-weight: 500;
        color: #333;
        min-width: 60px;
        flex-shrink: 0;
    }

    .property-value {
        font-family: 'Courier New', monospace;
        color: #666;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
        flex-shrink: 1;
    }

    .multi-selection {
        margin-top: 1rem;
        font-size: 0.9rem;
        color: #666;
        font-style: italic;
        text-align: center;
    }

    .hover-info {
        margin-top: 1rem;
        font-size: 0.9rem;
        color: rgb(0, 83, 135);
        font-style: italic;
        text-align: center;
    }

    .offset-info {
        margin-top: 1rem;
        font-size: 0.9rem;
        color: rgb(0, 133, 84);
        font-style: italic;
        text-align: center;
    }
</style>
