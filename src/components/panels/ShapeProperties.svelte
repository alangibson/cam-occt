<script lang="ts">
    import { drawingStore } from '$lib/stores/drawing/store';
    import type { ShapeData } from '$lib/cam/shape/interfaces';
    import { GeometryType } from '$lib/geometry/enums';
    import type { Point2D } from '$lib/geometry/point/interfaces';
    import type { Line } from '$lib/geometry/line/interfaces';
    import type { Arc } from '$lib/geometry/arc/interfaces';
    import type { Circle } from '$lib/geometry/circle/interfaces';
    import type { Polyline } from '$lib/geometry/polyline/interfaces';
    import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
    import type { Spline } from '$lib/geometry/spline/interfaces';
    import {
        getShapeStartPoint,
        getShapeEndPoint,
    } from '$lib/cam/shape/functions';
    import { polylineToPoints } from '$lib/geometry/polyline/functions';
    import InspectProperties from './InspectProperties.svelte';

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

    function getShapeOrigin(shape: ShapeData): Point2D {
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

    function getShapeTypeDisplay(shape: ShapeData): string {
        return shape.type.toUpperCase();
    }

    // Build properties array for the grid
    $: properties = displayShape
        ? (() => {
              const props: Array<{ property: string; value: string }> = [];

              // Type is always first
              props.push({
                  property: 'Type',
                  value: getShapeTypeDisplay(displayShape),
              });

              props.push({
                  property: 'Name',
                  value: displayShape.id,
              });

              if (displayShape.layer) {
                  props.push({
                      property: 'Layer',
                      value: displayShape.layer,
                  });
              }

              props.push({
                  property: 'Origin',
                  value: formatPoint(getShapeOrigin(displayShape)),
              });

              props.push({
                  property: 'Start',
                  value: formatPoint(getShapeStartPoint(displayShape)),
              });

              props.push({
                  property: 'End',
                  value: formatPoint(getShapeEndPoint(displayShape)),
              });

              // Add type-specific properties
              if (
                  displayShape.type === GeometryType.CIRCLE ||
                  displayShape.type === GeometryType.ARC
              ) {
                  const geometry = displayShape.geometry as Circle | Arc;
                  props.push({
                      property: 'Radius',
                      value: geometry.radius.toFixed(2),
                  });

                  if (displayShape.type === GeometryType.ARC) {
                      const arcGeometry = displayShape.geometry as Arc;
                      props.push({
                          property: 'Start Angle',
                          value:
                              (
                                  (arcGeometry.startAngle * 180) /
                                  Math.PI
                              ).toFixed(1) + '°',
                      });
                      props.push({
                          property: 'End Angle',
                          value:
                              ((arcGeometry.endAngle * 180) / Math.PI).toFixed(
                                  1
                              ) + '°',
                      });
                      props.push({
                          property: 'Direction',
                          value: arcGeometry.clockwise
                              ? 'Clockwise'
                              : 'Counter-clockwise',
                      });
                  }
              }

              if (displayShape.type === GeometryType.ELLIPSE) {
                  const ellipseGeometry = displayShape.geometry as Ellipse;
                  props.push({
                      property: 'Center',
                      value: formatPoint(ellipseGeometry.center),
                  });
                  props.push({
                      property: 'Major Axis End',
                      value: formatPoint(ellipseGeometry.majorAxisEndpoint),
                  });
                  props.push({
                      property: 'Minor/Major Ratio',
                      value: ellipseGeometry.minorToMajorRatio.toFixed(3),
                  });

                  if (
                      ellipseGeometry.startParam !== undefined &&
                      ellipseGeometry.endParam !== undefined
                  ) {
                      props.push({
                          property: 'Start Param',
                          value: ellipseGeometry.startParam.toFixed(3),
                      });
                      props.push({
                          property: 'End Param',
                          value: ellipseGeometry.endParam.toFixed(3),
                      });
                      props.push({
                          property: 'Direction',
                          value: 'Counter-clockwise',
                      });
                  }
              }

              if (displayShape.type === GeometryType.SPLINE) {
                  const splineGeometry = displayShape.geometry as Spline;
                  props.push({
                      property: 'Degree',
                      value: String(splineGeometry.degree),
                  });

                  if (
                      splineGeometry.controlPoints &&
                      splineGeometry.controlPoints.length > 0
                  ) {
                      props.push({
                          property: 'Control Points',
                          value: String(splineGeometry.controlPoints.length),
                      });
                  }

                  if (splineGeometry.knots && splineGeometry.knots.length > 0) {
                      props.push({
                          property: 'Knots',
                          value: String(splineGeometry.knots.length),
                      });
                  }

                  if (
                      splineGeometry.weights &&
                      splineGeometry.weights.length > 0
                  ) {
                      props.push({
                          property: 'Weights',
                          value: String(splineGeometry.weights.length),
                      });
                  }

                  if (
                      splineGeometry.fitPoints &&
                      splineGeometry.fitPoints.length > 0
                  ) {
                      props.push({
                          property: 'Fit Points',
                          value: String(splineGeometry.fitPoints.length),
                      });
                  }

                  props.push({
                      property: 'Closed',
                      value: splineGeometry.closed ? 'Yes' : 'No',
                  });
              }

              return props;
          })()
        : [];

    async function copyShapeToClipboard() {
        if (!displayShape) return;

        try {
            const json = JSON.stringify(displayShape, null, 2);
            await navigator.clipboard.writeText(json);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    }
</script>

<div class="shape-properties">
    {#if displayShape}
        <InspectProperties {properties} onCopy={copyShapeToClipboard}>
            {#if isShowingOffset}
                <p class="offset-info">Showing offset shape</p>
            {:else if isShowingHovered}
                <p class="hover-info">
                    Showing hovered shape (click to select)
                </p>
            {:else if selectedShapes.size > 1}
                <p class="multi-selection">
                    {selectedShapes.size} shapes selected (showing first)
                </p>
            {/if}
        </InspectProperties>
    {/if}
</div>

<style>
    .shape-properties {
        min-height: 200px;
    }

    .multi-selection,
    .hover-info,
    .offset-info {
        margin-top: 0.5rem;
        font-size: 0.875rem;
        font-style: italic;
        text-align: center;
        padding: 0.5rem;
        border-radius: 0.25rem;
    }

    .multi-selection {
        color: #666;
        background-color: #f9fafb;
    }

    .hover-info {
        color: rgb(0, 83, 135);
        background-color: #eff6ff;
    }

    .offset-info {
        color: rgb(0, 133, 84);
        background-color: #f0fdf4;
    }
</style>
