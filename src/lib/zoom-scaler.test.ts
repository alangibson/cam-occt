import { describe, it, expect } from 'vitest';
import { ZoomScaler } from '$lib/zoom-scaler.js';

describe('ZoomScaler', () => {
	describe('calculateScale', () => {
		it('should calculate correct scale for mm at 100% zoom', () => {
			const result = ZoomScaler.calculateScale(100, 'mm');
			
			// At 100% zoom, 1mm should equal ~3.78 pixels (96 DPI / 25.4 mm/inch)
			const expectedPixelsPerMm = 96 / 25.4;
			expect(result.pixelsPerUnit).toBeCloseTo(expectedPixelsPerMm, 2);
			expect(result.scale).toBeCloseTo(expectedPixelsPerMm, 2);
			expect(result.debug.zoomPercent).toBe(100);
			expect(result.debug.units).toBe('mm');
		});

		it('should calculate correct scale for inches at 100% zoom', () => {
			const result = ZoomScaler.calculateScale(100, 'inches');
			
			// At 100% zoom, 1 inch should equal 96 pixels (96 DPI)
			expect(result.pixelsPerUnit).toBe(96);
			expect(result.scale).toBe(96);
			expect(result.debug.zoomPercent).toBe(100);
			expect(result.debug.units).toBe('inches');
		});

		it('should scale proportionally with zoom percentage', () => {
			const result100 = ZoomScaler.calculateScale(100, 'mm');
			const result200 = ZoomScaler.calculateScale(200, 'mm');
			const result50 = ZoomScaler.calculateScale(50, 'mm');
			
			// Scale should be proportional to zoom
			expect(result200.scale).toBeCloseTo(result100.scale * 2, 2);
			expect(result50.scale).toBeCloseTo(result100.scale * 0.5, 2);
		});

		it('should provide consistent debug information', () => {
			const result = ZoomScaler.calculateScale(150, 'inches');
			
			expect(result.debug.zoomPercent).toBe(150);
			expect(result.debug.units).toBe('inches');
			expect(result.debug.screenDPI).toBe(96);
			expect(result.debug.basePixelsPerUnit).toBe(96);
			expect(result.debug.finalScale).toBe(result.scale);
		});
	});

	describe('validateZoom', () => {
		it('should enforce minimum zoom of 5%', () => {
			expect(ZoomScaler.validateZoom(1)).toBe(5);
			expect(ZoomScaler.validateZoom(-10)).toBe(5);
			expect(ZoomScaler.validateZoom(0)).toBe(5);
		});

		it('should enforce maximum zoom of 500%', () => {
			expect(ZoomScaler.validateZoom(1000)).toBe(500);
			expect(ZoomScaler.validateZoom(600)).toBe(500);
		});

		it('should pass through valid zoom values', () => {
			expect(ZoomScaler.validateZoom(50)).toBe(50);
			expect(ZoomScaler.validateZoom(100)).toBe(100);
			expect(ZoomScaler.validateZoom(200)).toBe(200);
			expect(ZoomScaler.validateZoom(500)).toBe(500);
			expect(ZoomScaler.validateZoom(5)).toBe(5);
		});
	});

	describe('realWorldToPixels', () => {
		it('should convert mm to pixels correctly', () => {
			// 10mm at 100% zoom should be ~37.8 pixels
			const pixels = ZoomScaler.realWorldToPixels(10, 'mm', 100);
			expect(pixels).toBeCloseTo(37.8, 1);
		});

		it('should convert inches to pixels correctly', () => {
			// 1 inch at 100% zoom should be 96 pixels
			const pixels = ZoomScaler.realWorldToPixels(1, 'inches', 100);
			expect(pixels).toBe(96);
		});

		it('should scale with zoom percentage', () => {
			const pixels100 = ZoomScaler.realWorldToPixels(10, 'mm', 100);
			const pixels200 = ZoomScaler.realWorldToPixels(10, 'mm', 200);
			
			expect(pixels200).toBeCloseTo(pixels100 * 2, 1);
		});
	});

	describe('pixelsToRealWorld', () => {
		it('should convert pixels to mm correctly', () => {
			// ~37.8 pixels should be 10mm at 100% zoom
			const mm = ZoomScaler.pixelsToRealWorld(37.8, 'mm', 100);
			expect(mm).toBeCloseTo(10, 1);
		});

		it('should convert pixels to inches correctly', () => {
			// 96 pixels should be 1 inch at 100% zoom
			const inches = ZoomScaler.pixelsToRealWorld(96, 'inches', 100);
			expect(inches).toBe(1);
		});

		it('should be inverse of realWorldToPixels', () => {
			const originalValue = 25.5;
			const pixels = ZoomScaler.realWorldToPixels(originalValue, 'mm', 150);
			const convertedBack = ZoomScaler.pixelsToRealWorld(pixels, 'mm', 150);
			
			expect(convertedBack).toBeCloseTo(originalValue, 2);
		});
	});

	describe('calculatePixelBounds', () => {
		it('should calculate pixel bounds correctly', () => {
			const realBounds = { width: 100, height: 50 }; // 100mm x 50mm
			const pixelBounds = ZoomScaler.calculatePixelBounds(realBounds, 'mm', 100);
			
			// 100mm should be ~378 pixels, 50mm should be ~189 pixels
			expect(pixelBounds.width).toBeCloseTo(378, 0);
			expect(pixelBounds.height).toBeCloseTo(189, 0);
		});

		it('should scale bounds with zoom', () => {
			const realBounds = { width: 1, height: 1 }; // 1 inch x 1 inch
			const bounds100 = ZoomScaler.calculatePixelBounds(realBounds, 'inches', 100);
			const bounds200 = ZoomScaler.calculatePixelBounds(realBounds, 'inches', 200);
			
			expect(bounds100.width).toBe(96);
			expect(bounds100.height).toBe(96);
			expect(bounds200.width).toBe(192);
			expect(bounds200.height).toBe(192);
		});
	});

	describe('critical zoom accuracy requirements', () => {
		it('should ensure 100mm at 100% zoom measures exactly 100mm on screen', () => {
			const result = ZoomScaler.calculateScale(100, 'mm');
			const pixelsFor100mm = 100 * result.pixelsPerUnit;
			
			// 100mm should convert to the correct number of pixels for screen measurement
			const expectedPixels = 100 * (96 / 25.4); // 100mm * (pixels per mm)
			expect(pixelsFor100mm).toBeCloseTo(expectedPixels, 1);
		});

		it('should ensure 2 inches at 100% zoom measures exactly 2 inches on screen', () => {
			const result = ZoomScaler.calculateScale(100, 'inches');
			const pixelsFor2Inches = 2 * result.pixelsPerUnit;
			
			// 2 inches should be exactly 192 pixels at 96 DPI
			expect(pixelsFor2Inches).toBe(192);
		});

		it('should maintain proportional scaling at all zoom levels', () => {
			const testSizes = [10, 25.4, 50, 100]; // Various sizes in mm
			const testZooms = [25, 50, 100, 150, 200, 300];
			
			for (const size of testSizes) {
				for (const zoom of testZooms) {
					const pixels = ZoomScaler.realWorldToPixels(size, 'mm', zoom);
					const backConverted = ZoomScaler.pixelsToRealWorld(pixels, 'mm', zoom);
					
					// Round-trip conversion should be accurate
					expect(backConverted).toBeCloseTo(size, 2);
				}
			}
		});

		it('should provide consistent scaling across unit conversions', () => {
			// 25.4mm should equal 1 inch
			const mm25_4_pixels = ZoomScaler.realWorldToPixels(25.4, 'mm', 100);
			const inch1_pixels = ZoomScaler.realWorldToPixels(1, 'inches', 100);
			
			expect(mm25_4_pixels).toBeCloseTo(inch1_pixels, 1);
		});
	});
});