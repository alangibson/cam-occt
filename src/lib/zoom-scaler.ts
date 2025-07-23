/**
 * ZoomScaler: Handles accurate zoom scaling to ensure displayed geometry size matches real-world units
 * 
 * CRITICAL RULE: At any zoom percentage, the displayed size on screen must exactly match 
 * the zoom factor. If an object is 100mm wide and zoom is 100%, it must measure 100mm on screen.
 * If zoom is 200%, it must measure 200mm on screen.
 */

export type UnitType = 'mm' | 'inches';

export interface ZoomScaleResult {
	scale: number;
	pixelsPerUnit: number;
	debug: {
		zoomPercent: number;
		units: UnitType;
		screenDPI: number;
		basePixelsPerUnit: number;
		finalScale: number;
	};
}

export class ZoomScaler {
	private static readonly SCREEN_DPI = 96; // Standard screen DPI
	private static readonly MM_PER_INCH = 25.4;

	/**
	 * Calculate the Three.js scale factor needed to achieve accurate zoom display
	 * 
	 * @param zoomPercent - Current zoom percentage (100 = natural size)
	 * @param units - Display units ('mm' or 'inches')
	 * @returns Scale information needed for Three.js geometry
	 */
	static calculateScale(zoomPercent: number, units: UnitType): ZoomScaleResult {
		// Calculate base pixels per unit at 100% zoom
		const basePixelsPerUnit = this.getPixelsPerUnit(units);
		
		// Apply zoom factor to pixels per unit
		const zoomFactor = zoomPercent / 100;
		const pixelsPerUnit = basePixelsPerUnit * zoomFactor;
		
		// In Three.js, we need to scale geometry so that 1 Three.js unit = 1 pixel
		// Since our DXF coordinates are in real-world units, we need to convert them to pixels
		const scale = pixelsPerUnit;
		
		const result: ZoomScaleResult = {
			scale,
			pixelsPerUnit,
			debug: {
				zoomPercent,
				units,
				screenDPI: this.SCREEN_DPI,
				basePixelsPerUnit,
				finalScale: scale
			}
		};
		
		console.log(`ZoomScaler: ${zoomPercent}% zoom, ${units} -> scale: ${scale.toFixed(4)}, px/unit: ${pixelsPerUnit.toFixed(2)}`);
		
		return result;
	}

	/**
	 * Get pixels per unit for the given unit type at 100% zoom (1:1 scale)
	 */
	private static getPixelsPerUnit(units: UnitType): number {
		switch (units) {
			case 'mm':
				// 96 DPI = 96 pixels per inch
				// 1 inch = 25.4mm
				// So 96/25.4 = ~3.78 pixels per mm
				return this.SCREEN_DPI / this.MM_PER_INCH;
			case 'inches':
				// 96 pixels per inch at standard DPI
				return this.SCREEN_DPI;
			default:
				throw new Error(`Unsupported unit type: ${units}`);
		}
	}

	/**
	 * Validate that a zoom percentage is within acceptable bounds
	 */
	static validateZoom(zoomPercent: number): number {
		return Math.max(5, Math.min(500, zoomPercent));
	}

	/**
	 * Convert real-world measurements to pixels at the given zoom level
	 */
	static realWorldToPixels(value: number, units: UnitType, zoomPercent: number): number {
		const scaleResult = this.calculateScale(zoomPercent, units);
		return value * scaleResult.pixelsPerUnit;
	}

	/**
	 * Convert pixels to real-world measurements at the given zoom level
	 */
	static pixelsToRealWorld(pixels: number, units: UnitType, zoomPercent: number): number {
		const scaleResult = this.calculateScale(zoomPercent, units);
		return pixels / scaleResult.pixelsPerUnit;
	}

	/**
	 * Calculate the geometry bounds in pixels for the given real-world bounds
	 */
	static calculatePixelBounds(
		realWorldBounds: { width: number; height: number },
		units: UnitType,
		zoomPercent: number
	): { width: number; height: number } {
		const scaleResult = this.calculateScale(zoomPercent, units);
		return {
			width: realWorldBounds.width * scaleResult.pixelsPerUnit,
			height: realWorldBounds.height * scaleResult.pixelsPerUnit
		};
	}
}