/* eslint-disable no-magic-numbers */
import type { Arc } from '$lib/geometry/arc';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { tessellateSpline } from '$lib/geometry/spline';
import { type Ellipse, tessellateEllipse } from '$lib/geometry/ellipse/index';
import { type Polyline, polylineToPoints } from '$lib/geometry/polyline';
import { getShapeBoundingBox } from '$lib/geometry/bounding-box/functions';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { Circle } from '$lib/geometry/circle';
import type { Line } from '$lib/geometry/line';
import type { Shape } from '$lib/geometry/shape';
import type { Spline } from '$lib/geometry/spline';
import type { OffsetChain } from '$lib/algorithms/offset-calculation/chain/types';

/**
 * Visual Test Module
 *
 * Generates SVG visualizations of chain offset operations for manual inspection.
 * This helps verify the correctness of offset algorithms visually.
 */

interface VisualizationOptions {
    /** Width of the SVG canvas */
    width?: number;
    /** Height of the SVG canvas */
    height?: number;
    /** Padding around the content */
    padding?: number;
    /** Show grid lines */
    showGrid?: boolean;
    /** Grid spacing */
    gridSpacing?: number;
    /** Show labels */
    showLabels?: boolean;
}

const DEFAULT_VIS_OPTIONS: Required<VisualizationOptions> = {
    width: 800,
    height: 600,
    padding: 50,
    showGrid: true,
    gridSpacing: 10,
    showLabels: true,
};

/**
 * Generates an SVG visualization of chain offsets
 *
 * @param chain - Original chain
 * @param offsets - Array of offset chains
 * @param filename - Output filename (without extension)
 * @param options - Visualization options
 */
export function generateChainOffsetSVG(
    chain: Chain,
    offsets: OffsetChain[],
    filename: string,
    options?: VisualizationOptions
): void {
    const opts: Required<VisualizationOptions> = {
        ...DEFAULT_VIS_OPTIONS,
        ...options,
    };

    // Calculate bounds of all shapes
    const bounds: { minX: number; minY: number; maxX: number; maxY: number } =
        calculateBounds(chain, offsets);

    // Calculate scale to fit in canvas
    const scale: number = calculateScale(bounds, opts);

    // Generate SVG content
    const svg: string = generateSVG(chain, offsets, bounds, scale, opts);

    // Write to file
    const outputPath: string = join(
        process.cwd(),
        'tests',
        'output',
        'visual',
        'chain',
        `${filename}.svg`
    );
    writeFileSync(outputPath, svg);
}

/**
 * Aggregate shape bounds into overall bounds
 */
function aggregateShapeBounds(shapes: Shape[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
} {
    let minX: number = Infinity,
        minY: number = Infinity;
    let maxX: number = -Infinity,
        maxY: number = -Infinity;

    for (const shape of shapes) {
        const shapeBounds = getShapeBoundingBox(shape);
        minX = Math.min(minX, shapeBounds.min.x);
        minY = Math.min(minY, shapeBounds.min.y);
        maxX = Math.max(maxX, shapeBounds.max.x);
        maxY = Math.max(maxY, shapeBounds.max.y);
    }

    return { minX, minY, maxX, maxY };
}

/**
 * Calculate bounds of all shapes
 */
function calculateBounds(
    chain: Chain,
    offsets: OffsetChain[]
): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX: number = Infinity,
        minY: number = Infinity;
    let maxX: number = -Infinity,
        maxY: number = -Infinity;

    // Include original chain
    const chainBounds = aggregateShapeBounds(chain.shapes);
    minX = Math.min(minX, chainBounds.minX);
    minY = Math.min(minY, chainBounds.minY);
    maxX = Math.max(maxX, chainBounds.maxX);
    maxY = Math.max(maxY, chainBounds.maxY);

    // Include all offset chains
    for (const offset of offsets) {
        const offsetBounds = aggregateShapeBounds(offset.shapes);
        minX = Math.min(minX, offsetBounds.minX);
        minY = Math.min(minY, offsetBounds.minY);
        maxX = Math.max(maxX, offsetBounds.maxX);
        maxY = Math.max(maxY, offsetBounds.maxY);
    }

    return { minX, minY, maxX, maxY };
}

/**
 * Calculate scale factor to fit content in canvas
 */
function calculateScale(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    options: Required<VisualizationOptions>
): number {
    const contentWidth: number = bounds.maxX - bounds.minX;
    const contentHeight: number = bounds.maxY - bounds.minY;

    const availableWidth: number = options.width - 2 * options.padding;
    const availableHeight: number = options.height - 2 * options.padding;

    const scaleX: number = availableWidth / contentWidth;
    const scaleY: number = availableHeight / contentHeight;

    return Math.min(scaleX, scaleY);
}

/**
 * Generate complete SVG content
 */
function generateSVG(
    chain: Chain,
    offsets: OffsetChain[],
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    scale: number,
    options: Required<VisualizationOptions>
): string {
    const transform: string = `translate(${options.padding}, ${options.padding}) scale(${scale}, ${-scale}) translate(${-bounds.minX}, ${-bounds.maxY})`;

    let svg: string = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${options.width}" height="${options.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#000" />
    </marker>
  </defs>
  
  <!-- Background -->
  <rect width="${options.width}" height="${options.height}" fill="white" />
  
  <!-- Main content group with transformation -->
  <g transform="${transform}">`;

    // Add grid if requested
    if (options.showGrid) {
        svg += generateGrid(bounds, options.gridSpacing);
    }

    // Draw original chain in black
    svg += '\n    <!-- Original Chain -->';
    svg += '\n    <g stroke="black" stroke-width="2" fill="none">';
    for (const shape of chain.shapes) {
        svg += '\n      ' + shapeToSVG(shape);
    }
    svg += '\n    </g>';

    // Draw offset chains with different colors based on side (always solid lines)
    for (const offset of offsets) {
        const color: string = getOffsetColor(offset);
        const strokeWidth: number = 1.5;

        svg += `\n    <!-- ${offset.side} Offset -->`;
        svg += `\n    <g stroke="${color}" stroke-width="${strokeWidth}" fill="none">`;
        for (const shape of offset.shapes) {
            svg += '\n      ' + shapeToSVG(shape);
        }
        svg += '\n    </g>';

        // Draw trim points
        if (offset.trimPoints) {
            svg += '\n    <!-- Trim Points -->';
            svg += '\n    <g fill="green" stroke="none">';
            for (const trim of offset.trimPoints) {
                svg += `\n      <circle cx="${trim.point.x}" cy="${trim.point.y}" r="3" />`;
            }
            svg += '\n    </g>';
        }

        // Draw gap fills
        if (offset.gapFills) {
            svg += '\n    <!-- Gap Fills -->';
            svg += '\n    <g stroke="orange" stroke-width="2" fill="none">';
            for (const gap of offset.gapFills) {
                if (gap.fillerShape) {
                    svg += '\n      ' + shapeToSVG(gap.fillerShape);
                }
            }
            svg += '\n    </g>';
        }

        // Draw intersection points
        if (offset.intersectionPoints) {
            svg += '\n    <!-- Intersection Points -->';
            svg += '\n    <g fill="yellow" stroke="black" stroke-width="0.5">';
            for (const intersection of offset.intersectionPoints) {
                svg += `\n      <circle cx="${intersection.point.x}" cy="${intersection.point.y}" r="2" />`;
            }
            svg += '\n    </g>';
        }
    }

    svg += '\n  </g>';

    // Add legend
    if (options.showLabels) {
        svg += generateLegend(options);
    }

    svg += '\n</svg>';

    return svg;
}

/**
 * Generate grid lines
 */
function generateGrid(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    spacing: number
): string {
    let grid: string =
        '\n    <!-- Grid -->\n    <g stroke="#ddd" stroke-width="0.5">';

    // Vertical lines
    for (
        let x: number = Math.floor(bounds.minX / spacing) * spacing;
        x <= bounds.maxX;
        x += spacing
    ) {
        grid += `\n      <line x1="${x}" y1="${bounds.minY}" x2="${x}" y2="${bounds.maxY}" />`;
    }

    // Horizontal lines
    for (
        let y: number = Math.floor(bounds.minY / spacing) * spacing;
        y <= bounds.maxY;
        y += spacing
    ) {
        grid += `\n      <line x1="${bounds.minX}" y1="${y}" x2="${bounds.maxX}" y2="${y}" />`;
    }

    grid += '\n    </g>';
    return grid;
}

/**
 * Convert a shape to SVG path
 */
function shapeToSVG(shape: Shape): string {
    switch (shape.type) {
        case 'line': {
            const line: Line = shape.geometry as Line;
            return `<line x1="${line.start.x}" y1="${line.start.y}" x2="${line.end.x}" y2="${line.end.y}" />`;
        }

        case 'arc':
            return arcToSVG(shape);

        case 'circle': {
            const circle: Circle = shape.geometry as Circle;
            return `<circle cx="${circle.center.x}" cy="${circle.center.y}" r="${circle.radius}" />`;
        }

        case 'polyline': {
            const polyline: Polyline = shape.geometry as Polyline;
            const points: string = polylineToPoints(polyline)
                .map((p: { x: number; y: number }) => `${p.x},${p.y}`)
                .join(' ');
            return `<polyline points="${points}" />`;
        }

        case 'spline': {
            const spline: Spline = shape.geometry as Spline;
            const tessellationResult: { points: { x: number; y: number }[] } =
                tessellateSpline(spline, {
                    method: 'verb-nurbs',
                    numSamples: 50,
                });
            const points: string = tessellationResult.points
                .map((p) => `${p.x},${p.y}`)
                .join(' ');
            return `<polyline points="${points}" />`;
        }

        case 'ellipse': {
            const ellipse: Ellipse = shape.geometry as Ellipse;
            const points: { x: number; y: number }[] = tessellateEllipse(
                ellipse,
                32
            );
            const pointsStr: string = points
                .map((p) => `${p.x},${p.y}`)
                .join(' ');
            return `<polyline points="${pointsStr}" />`;
        }

        default:
            // Fallback for unknown shape types
            return `<!-- ${shape.type} ${shape.id} -->`;
    }
}

/**
 * Convert arc to SVG path
 */
function arcToSVG(shape: Shape): string {
    const arc: Arc = shape.geometry as Arc;
    const start: { x: number; y: number } = {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle),
    };

    const end: { x: number; y: number } = {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle),
    };

    // Calculate the angular span - use the shorter arc path
    // The direction flag (clockwise) will be used for SVG sweep flag only

    // Calculate both possible angular spans
    let clockwiseSpan: number = arc.startAngle - arc.endAngle;
    if (clockwiseSpan <= 0) clockwiseSpan += 2 * Math.PI;

    let counterClockwiseSpan: number = arc.endAngle - arc.startAngle;
    if (counterClockwiseSpan <= 0) counterClockwiseSpan += 2 * Math.PI;

    // Always use the shorter path for the arc span calculation
    const angularSpan: number = Math.min(clockwiseSpan, counterClockwiseSpan);

    const largeArc: number = angularSpan > Math.PI ? 1 : 0;
    // SVG sweep flag: 0 = counter-clockwise, 1 = clockwise
    // Since we're transforming from CNC coordinates (Y up) to SVG coordinates (Y down),
    // the clockwise flag needs to be flipped for proper SVG rendering
    const sweep: number = arc.clockwise ? 0 : 1;

    return `<path d="M ${start.x} ${start.y} A ${arc.radius} ${arc.radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}" />`;
}

/**
 * Get color for offset based on side
 */
function getOffsetColor(offset: OffsetChain): string {
    switch (offset.side) {
        case 'inner':
        case 'left':
            return 'blue';
        case 'outer':
        case 'right':
            return 'red';
        default:
            return 'gray';
    }
}

/**
 * Generate legend
 */
function generateLegend(options: Required<VisualizationOptions>): string {
    const x: number = options.width - 150;
    const y: number = 20;

    return `
  <!-- Legend -->
  <g font-family="Arial" font-size="12">
    <rect x="${x - 10}" y="${y - 5}" width="140" height="180" fill="white" stroke="black" />
    
    <line x1="${x}" y1="${y + 10}" x2="${x + 30}" y2="${y + 10}" stroke="black" stroke-width="2" />
    <text x="${x + 35}" y="${y + 14}">Original Chain</text>
    
    <line x1="${x}" y1="${y + 30}" x2="${x + 30}" y2="${y + 30}" stroke="gray" stroke-width="1.5" stroke-dasharray="5,5" />
    <text x="${x + 35}" y="${y + 34}">Raw Offsets</text>
    
    <line x1="${x}" y1="${y + 50}" x2="${x + 30}" y2="${y + 50}" stroke="blue" stroke-width="1.5" />
    <text x="${x + 35}" y="${y + 54}">Inner/Left</text>
    
    <line x1="${x}" y1="${y + 70}" x2="${x + 30}" y2="${y + 70}" stroke="red" stroke-width="1.5" />
    <text x="${x + 35}" y="${y + 74}">Outer/Right</text>
    
    <circle cx="${x + 15}" cy="${y + 90}" r="3" fill="green" />
    <text x="${x + 35}" y="${y + 94}">Trim Points</text>
    
    <circle cx="${x + 15}" cy="${y + 110}" r="2" fill="yellow" stroke="black" stroke-width="0.5" />
    <text x="${x + 35}" y="${y + 114}">Intersections</text>
    
    <line x1="${x}" y1="${y + 130}" x2="${x + 30}" y2="${y + 130}" stroke="orange" stroke-width="2" />
    <text x="${x + 35}" y="${y + 134}">Gap Fills</text>
  </g>`;
}
