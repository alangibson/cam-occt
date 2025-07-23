import { describe, it, expect } from 'vitest';
import { 
  getPixelsPerUnit, 
  convertUnits, 
  getPhysicalScaleFactor, 
  formatValue, 
  getUnitSymbol 
} from './units';

describe('Units utilities', () => {
  describe('getPixelsPerUnit', () => {
    it('should return correct pixels per mm', () => {
      const pixelsPerMm = getPixelsPerUnit('mm');
      expect(pixelsPerMm).toBeCloseTo(3.78, 2); // ~96/25.4
    });

    it('should return correct pixels per inch', () => {
      const pixelsPerInch = getPixelsPerUnit('inch');
      expect(pixelsPerInch).toBe(96);
    });
  });

  describe('convertUnits', () => {
    it('should convert mm to inches correctly', () => {
      const result = convertUnits(25.4, 'mm', 'inch');
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('should convert inches to mm correctly', () => {
      const result = convertUnits(1.0, 'inch', 'mm');
      expect(result).toBeCloseTo(25.4, 5);
    });

    it('should return same value for same units', () => {
      expect(convertUnits(10, 'mm', 'mm')).toBe(10);
      expect(convertUnits(5, 'inch', 'inch')).toBe(5);
    });
  });

  describe('getPhysicalScaleFactor', () => {
    it('should return display unit pixels per unit', () => {
      // When displaying as mm, use mm scale regardless of geometry units
      expect(getPhysicalScaleFactor('mm', 'mm')).toBeCloseTo(3.78, 2);
      expect(getPhysicalScaleFactor('inch', 'mm')).toBeCloseTo(3.78, 2);
      
      // When displaying as inches, use inch scale regardless of geometry units  
      expect(getPhysicalScaleFactor('mm', 'inch')).toBe(96);
      expect(getPhysicalScaleFactor('inch', 'inch')).toBe(96);
    });
  });

  describe('formatValue', () => {
    it('should format mm values with 1 decimal place', () => {
      expect(formatValue(12.3456, 'mm')).toBe('12.3');
      expect(formatValue(10, 'mm')).toBe('10.0');
    });

    it('should format inch values with 3 decimal places', () => {
      expect(formatValue(1.2345678, 'inch')).toBe('1.235');
      expect(formatValue(2, 'inch')).toBe('2.000');
    });
  });

  describe('getUnitSymbol', () => {
    it('should return correct symbols', () => {
      expect(getUnitSymbol('mm')).toBe('mm');
      expect(getUnitSymbol('inch')).toBe('in');
    });
  });

  describe('Physical scaling integration', () => {
    it('should display geometry values at display unit physical size', () => {
      // 186.2mm geometry displayed as mm should be 186.2mm on screen
      const geometryValue = 186.2;
      const mmDisplayPixels = geometryValue * getPhysicalScaleFactor('mm', 'mm');
      const mmOnScreen = mmDisplayPixels / (96 / 25.4);
      expect(mmOnScreen).toBeCloseTo(186.2, 1);

      // 186.2mm geometry displayed as inches should be 186.2" on screen  
      const inchDisplayPixels = geometryValue * getPhysicalScaleFactor('mm', 'inch');
      const inchesOnScreen = inchDisplayPixels / 96;
      expect(inchesOnScreen).toBeCloseTo(186.2, 1);
    });

    it('should scale appropriately when switching display units', () => {
      // Same geometry value should appear different physical sizes based on display unit
      const geometryValue = 100; // Could be 100mm or 100 inches from DXF
      
      // When displayed as mm: 100 units → 100mm on screen
      const mmPixels = geometryValue * getPhysicalScaleFactor('mm', 'mm');
      const mmOnScreen = mmPixels / (96 / 25.4);
      expect(mmOnScreen).toBeCloseTo(100, 1);
      
      // When displayed as inches: 100 units → 100" on screen  
      const inchPixels = geometryValue * getPhysicalScaleFactor('mm', 'inch');
      const inchesOnScreen = inchPixels / 96;
      expect(inchesOnScreen).toBeCloseTo(100, 1);
      
      // The inch display should be much larger than mm display
      expect(inchPixels).toBeGreaterThan(mmPixels);
    });
  });
});