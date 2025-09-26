/**
 * Centralized style definitions for canvas rendering
 */

/**
 * Color palette for rendering
 */
export enum Color {
    // Basic colors
    BLACK = '#000000',
    WHITE = '#ffffff',
    GRAY = '#888888',
    LIGHT_GRAY = '#cccccc',

    // Selection and hover
    ORANGE = '#ff6600',
    LIGHT_ORANGE = '#ff9933',

    // Paths and operations
    GREEN = 'rgb(0, 133, 84)',
    LIGHT_GREEN = 'rgba(0, 133, 84, 0.6)',
    DARK_GREEN = '#15803d',

    // Parts and chains
    BLUE = 'rgb(0, 83, 135)', // RAL 5005 Signal Blue
    LIGHT_BLUE = 'rgba(0, 83, 135, 0.6)',
    DARK_BLUE = '#004080',

    // Warnings and errors
    RED = 'rgb(133, 18, 0)',
    LIGHT_RED = 'rgba(133, 18, 0, 0.6)',

    // Highlights
    AMBER = '#f59e0b',
    LIGHT_AMBER = '#fbbf24',
    DARK_AMBER = '#d97706',

    // Rapids
    CYAN = '#06b6d4',
    LIGHT_CYAN = '#22d3ee',
}

/**
 * Line width definitions (in screen pixels)
 */
export enum LineWidth {
    THIN = 1,
    // eslint-disable-next-line no-magic-numbers
    NORMAL = 1.5,
    THICK = 2,
    // eslint-disable-next-line no-magic-numbers
    EXTRA_THICK = 3,
}

/**
 * Dash patterns for different line styles
 */
const DASH_UNIT = 5;
const GAP_UNIT = 3;
const DOT_UNIT = 1;
const GAP_SMALL = 2;
const DASH_LONG = 8;
const GAP_MEDIUM = 4;

export const DashPattern = {
    SOLID: [],
    DASHED: [DASH_UNIT, GAP_UNIT],
    DOTTED: [DOT_UNIT, GAP_SMALL],
    DASH_DOT: [DASH_UNIT, GAP_SMALL, DOT_UNIT, GAP_SMALL],
    LONG_DASH: [DASH_LONG, GAP_MEDIUM],
    SHORT_DASH: [GAP_UNIT, GAP_SMALL],
} as const;

/**
 * Shadow configurations
 */
export interface ShadowStyle {
    color: string;
    blur: number;
    offsetX?: number;
    offsetY?: number;
}

export const Shadow = {
    NONE: { color: 'transparent', blur: 0 },
    SUBTLE: { color: 'rgba(0, 0, 0, 0.2)', blur: 2 },
    NORMAL: { color: 'rgba(0, 0, 0, 0.3)', blur: 4 },
    STRONG: { color: 'rgba(0, 0, 0, 0.4)', blur: 6 },
    GLOW_GREEN: { color: Color.DARK_GREEN, blur: 4 },
    GLOW_AMBER: { color: Color.AMBER, blur: 3 },
    GLOW_ORANGE: { color: Color.ORANGE, blur: 4 },
} as const;

/**
 * Style configuration for different object states
 */
export interface StyleConfig {
    strokeColor: Color | string;
    lineWidth: LineWidth | number;
    dashPattern?: readonly number[];
    shadow?: ShadowStyle;
    fillColor?: Color | string;
    opacity?: number;
}

/**
 * Predefined style configurations
 */
export class StylePresets {
    // Shape styles
    static readonly SHAPE_NORMAL: StyleConfig = {
        strokeColor: Color.BLACK,
        lineWidth: LineWidth.THIN,
    };

    static readonly SHAPE_HOVERED: StyleConfig = {
        strokeColor: Color.ORANGE,
        lineWidth: LineWidth.NORMAL,
    };

    static readonly SHAPE_SELECTED: StyleConfig = {
        strokeColor: Color.ORANGE,
        lineWidth: LineWidth.THICK,
    };

    // Chain styles
    static readonly CHAIN_NORMAL: StyleConfig = {
        strokeColor: Color.BLUE,
        lineWidth: LineWidth.NORMAL,
    };

    static readonly CHAIN_SELECTED: StyleConfig = {
        strokeColor: Color.DARK_AMBER,
        lineWidth: LineWidth.THICK,
    };

    static readonly CHAIN_HIGHLIGHTED: StyleConfig = {
        strokeColor: Color.LIGHT_AMBER,
        lineWidth: LineWidth.THICK,
    };

    // Part styles
    static readonly PART_SHELL: StyleConfig = {
        strokeColor: Color.BLUE,
        lineWidth: LineWidth.NORMAL,
    };

    static readonly PART_HOLE: StyleConfig = {
        strokeColor: Color.LIGHT_BLUE,
        lineWidth: LineWidth.NORMAL,
    };

    static readonly PART_SELECTED: StyleConfig = {
        strokeColor: Color.AMBER,
        lineWidth: LineWidth.EXTRA_THICK,
        shadow: Shadow.GLOW_AMBER,
    };

    static readonly PART_HOVERED: StyleConfig = {
        strokeColor: Color.LIGHT_AMBER,
        lineWidth: LineWidth.THICK,
    };

    // Path styles
    static readonly PATH_NORMAL: StyleConfig = {
        strokeColor: Color.GREEN,
        lineWidth: LineWidth.THICK,
    };

    static readonly PATH_SELECTED: StyleConfig = {
        strokeColor: Color.GREEN,
        lineWidth: LineWidth.EXTRA_THICK,
    };

    static readonly PATH_HIGHLIGHTED: StyleConfig = {
        strokeColor: Color.DARK_GREEN,
        lineWidth: LineWidth.EXTRA_THICK,
        shadow: Shadow.GLOW_GREEN,
    };

    static readonly PATH_ORIGINAL: StyleConfig = {
        strokeColor: Color.LIGHT_GREEN,
        lineWidth: LineWidth.THIN,
        dashPattern: DashPattern.DASHED,
    };

    // Offset styles
    static readonly OFFSET_NORMAL: StyleConfig = {
        strokeColor: Color.GREEN,
        lineWidth: LineWidth.THICK,
    };

    static readonly OFFSET_SELECTED: StyleConfig = {
        strokeColor: Color.ORANGE,
        lineWidth: LineWidth.THICK,
    };

    // Rapid styles
    static readonly RAPID_NORMAL: StyleConfig = {
        strokeColor: Color.CYAN,
        lineWidth: LineWidth.THIN,
        dashPattern: DashPattern.LONG_DASH,
    };

    static readonly RAPID_SELECTED: StyleConfig = {
        strokeColor: Color.ORANGE,
        lineWidth: LineWidth.THICK,
        dashPattern: DashPattern.LONG_DASH,
    };

    static readonly RAPID_HIGHLIGHTED: StyleConfig = {
        strokeColor: Color.LIGHT_CYAN,
        lineWidth: LineWidth.THICK,
        dashPattern: DashPattern.LONG_DASH,
        shadow: Shadow.SUBTLE,
    };

    // Lead styles
    static readonly LEAD_IN: StyleConfig = {
        strokeColor: Color.BLUE,
        lineWidth: LineWidth.NORMAL,
    };

    static readonly LEAD_OUT: StyleConfig = {
        strokeColor: Color.RED,
        lineWidth: LineWidth.NORMAL,
    };

    // Overlay styles
    static readonly OVERLAY_ORIGIN: StyleConfig = {
        fillColor: Color.BLUE,
        strokeColor: Color.WHITE,
        lineWidth: LineWidth.THIN,
    };

    static readonly OVERLAY_START: StyleConfig = {
        fillColor: Color.GREEN,
        strokeColor: Color.WHITE,
        lineWidth: LineWidth.THIN,
    };

    static readonly OVERLAY_END: StyleConfig = {
        fillColor: Color.RED,
        strokeColor: Color.WHITE,
        lineWidth: LineWidth.THIN,
    };

    static readonly OVERLAY_POINT: StyleConfig = {
        fillColor: Color.GRAY,
        strokeColor: Color.WHITE,
        lineWidth: LineWidth.THIN,
    };

    // Grid and origin
    static readonly GRID: StyleConfig = {
        strokeColor: Color.LIGHT_GRAY,
        lineWidth: 0.5,
        opacity: 0.3,
    };

    static readonly ORIGIN_CROSS: StyleConfig = {
        strokeColor: Color.GRAY,
        lineWidth: LineWidth.THIN,
    };
}

/**
 * Style manager for applying styles to canvas context
 */
export class StyleManager {
    /**
     * Apply a style configuration to a canvas context
     */
    static applyStyle(ctx: CanvasRenderingContext2D, style: StyleConfig): void {
        // Set stroke color
        if (style.strokeColor) {
            ctx.strokeStyle = style.strokeColor;
        }

        // Set line width
        if (style.lineWidth !== undefined) {
            ctx.lineWidth = style.lineWidth;
        }

        // Set dash pattern
        if (style.dashPattern) {
            ctx.setLineDash(style.dashPattern);
        } else {
            ctx.setLineDash([]);
        }

        // Set shadow
        if (style.shadow) {
            ctx.shadowColor = style.shadow.color;
            ctx.shadowBlur = style.shadow.blur;
            ctx.shadowOffsetX = style.shadow.offsetX || 0;
            ctx.shadowOffsetY = style.shadow.offsetY || 0;
        } else {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }

        // Set fill color
        if (style.fillColor) {
            ctx.fillStyle = style.fillColor;
        }

        // Set opacity
        if (style.opacity !== undefined) {
            ctx.globalAlpha = style.opacity;
        } else {
            ctx.globalAlpha = 1;
        }
    }

    /**
     * Reset context to default style
     */
    static resetStyle(ctx: CanvasRenderingContext2D): void {
        ctx.strokeStyle = Color.BLACK;
        ctx.fillStyle = Color.BLACK;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.globalAlpha = 1;
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
    }
}
