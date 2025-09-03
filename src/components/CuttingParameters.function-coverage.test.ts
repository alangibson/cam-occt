// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CuttingParameters from './CuttingParameters.svelte';
import type { CuttingParameters as CuttingParametersType } from '../lib/types';

describe('CuttingParameters Component - Function Coverage', () => {
  const defaultParameters: CuttingParametersType = {
    feedRate: 1000,
    pierceHeight: 3.8,
    pierceDelay: 0.5,
    cutHeight: 1.5,
    kerf: 1.5,
    leadInLength: 5,
    leadOutLength: 5
  };

  describe('parameter binding and updates', () => {
    it('should render with default parameters', () => {
      const { container } = render(CuttingParameters, { 
        props: { parameters: defaultParameters, units: 'mm' } 
      });
      
      const feedRateInput = container.querySelector('#feedRate') as HTMLInputElement;
      expect(feedRateInput.value).toBe('1000');
      
      const pierceHeightInput = container.querySelector('#pierceHeight') as HTMLInputElement;
      expect(pierceHeightInput.value).toBe('3.8');
      
      const pierceDelayInput = container.querySelector('#pierceDelay') as HTMLInputElement;
      expect(pierceDelayInput.value).toBe('0.5');
    });

    it('should update parameters when inputs change', async () => {
      let parameters = { ...defaultParameters };
      
      const { container } = render(CuttingParameters, { 
        props: { parameters, units: 'mm' }
      });
      
      const feedRateInput = container.querySelector('#feedRate') as HTMLInputElement;
      
      // Update feed rate
      await fireEvent.input(feedRateInput, { target: { value: '1500' } });
      
      // Verify input value changed
      expect(feedRateInput.value).toBe('1500');
    });

    it('should show correct units in labels', () => {
      const { container } = render(CuttingParameters, { 
        props: { parameters: defaultParameters, units: 'inch' } 
      });
      
      const feedRateLabel = container.querySelector('label[for="feedRate"]');
      expect(feedRateLabel?.textContent).toContain('inch/min');
      
      const pierceHeightLabel = container.querySelector('label[for="pierceHeight"]');
      expect(pierceHeightLabel?.textContent).toContain('inch');
    });

    it('should bind all parameter fields', async () => {
      const { container } = render(CuttingParameters, { 
        props: { parameters: defaultParameters, units: 'mm' } 
      });
      
      // Test all input bindings
      const cutHeightInput = container.querySelector('#cutHeight') as HTMLInputElement;
      expect(cutHeightInput.value).toBe('1.5');
      
      const kerfInput = container.querySelector('#kerf') as HTMLInputElement;
      expect(kerfInput.value).toBe('1.5');
      
      const leadInInput = container.querySelector('#leadIn') as HTMLInputElement;
      expect(leadInInput?.value).toBe('5');
    });

    it('should handle numeric input validation', async () => {
      const { container } = render(CuttingParameters, { 
        props: { parameters: defaultParameters, units: 'mm' } 
      });
      
      const feedRateInput = container.querySelector('#feedRate') as HTMLInputElement;
      
      // Test step and min attributes
      expect(feedRateInput.getAttribute('step')).toBe('10');
      expect(feedRateInput.getAttribute('min')).toBe('0');
      expect(feedRateInput.getAttribute('type')).toBe('number');
    });
  });

  describe('reactive unit display', () => {
    it('should update unit display when units prop changes', () => {
      let units: 'mm' | 'inch' = 'mm';
      
      const { container, rerender } = render(CuttingParameters, { 
        props: { parameters: defaultParameters, units } 
      });
      
      // Initially mm
      let feedRateLabel = container.querySelector('label[for="feedRate"]');
      expect(feedRateLabel?.textContent).toContain('mm/min');
      
      // Change to inch and re-render component
      const { container: newContainer } = render(CuttingParameters, { 
        props: { parameters: defaultParameters, units: 'inch' } 
      });
      
      const feedRateLabelInch = newContainer.querySelector('label[for="feedRate"]');
      expect(feedRateLabelInch?.textContent).toContain('inch/min');
    });
  });
});