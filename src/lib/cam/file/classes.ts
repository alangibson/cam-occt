import { parseDXF } from '$lib/parsers/dxf/functions';
import { parseSVG } from '$lib/parsers/svg/functions';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { Unit, convertDrawingCoordinates } from '$lib/config/units/units';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { ImportUnitSetting } from '$lib/config/settings/enums';

/**
 * File type enumeration
 */
export enum FileType {
    DXF = 'dxf',
    SVG = 'svg',
}

/**
 * File class representing an imported file before conversion to Drawing
 */
export class File {
    name: string;
    type: FileType;
    contents: string;

    // Cache for parsed drawing data
    #parsedDrawing: DrawingData | null = null;

    constructor(name: string, type: FileType, contents: string) {
        this.name = name;
        this.type = type;
        this.contents = contents;
    }

    /**
     * Parse file contents and cache the result
     */
    private async parseFile(): Promise<DrawingData> {
        if (this.#parsedDrawing) {
            return this.#parsedDrawing;
        }

        let drawing: DrawingData;
        if (this.type === FileType.DXF) {
            drawing = parseDXF(this.contents);
        } else if (this.type === FileType.SVG) {
            drawing = parseSVG(this.contents);
        } else {
            throw new Error(`Unsupported file type: ${this.type}`);
        }

        // Add fileName to the drawing data
        drawing.fileName = this.name;

        // Cache the result
        this.#parsedDrawing = drawing;
        return drawing;
    }

    /**
     * Get the detected unit from the file
     * Parses the file if not already parsed
     */
    async getUnit(): Promise<Unit> {
        const drawing = await this.parseFile();
        return drawing.units;
    }

    /**
     * Convert file to Drawing with unit conversion
     * @param applicationUnit - The application's measurement unit setting
     * @param importUnitSetting - The import unit setting from user preferences
     * @returns Drawing instance with converted coordinates
     */
    async toDrawing(
        applicationUnit: Unit,
        importUnitSetting: ImportUnitSetting
    ): Promise<Drawing> {
        // Parse the file
        let drawingData = await this.parseFile();

        // Determine the detected unit from the file
        const detectedUnit = drawingData.units;

        // Determine effective source unit based on import setting
        let effectiveSourceUnit: Unit;
        switch (importUnitSetting) {
            case ImportUnitSetting.Automatic:
                // Use detected unit, but if NONE, assume application unit
                effectiveSourceUnit =
                    detectedUnit === Unit.NONE ? applicationUnit : detectedUnit;
                break;
            case ImportUnitSetting.Application:
                // Treat file as if it's in application units
                effectiveSourceUnit = applicationUnit;
                break;
            case ImportUnitSetting.Metric:
                // Treat file as metric
                effectiveSourceUnit = Unit.MM;
                break;
            case ImportUnitSetting.Imperial:
                // Treat file as imperial
                effectiveSourceUnit = Unit.INCH;
                break;
            default:
                // Fallback to automatic behavior
                effectiveSourceUnit =
                    detectedUnit === Unit.NONE ? applicationUnit : detectedUnit;
        }

        // Apply coordinate conversion if units don't match
        if (
            effectiveSourceUnit !== applicationUnit &&
            effectiveSourceUnit !== Unit.NONE
        ) {
            drawingData = convertDrawingCoordinates(
                drawingData,
                effectiveSourceUnit,
                applicationUnit
            );
        }

        // Set the final unit to application unit
        drawingData.units = applicationUnit;

        // Create and return Drawing instance
        return new Drawing(drawingData);
    }

    /**
     * Detect FileType from filename extension
     */
    static getFileTypeFromName(fileName: string): FileType | null {
        const lowerName = fileName.toLowerCase();
        if (lowerName.endsWith('.dxf')) {
            return FileType.DXF;
        } else if (lowerName.endsWith('.svg')) {
            return FileType.SVG;
        }
        return null;
    }
}
