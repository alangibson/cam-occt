import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn()
};

// Replace global localStorage
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('Resizable Columns localStorage Integration', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.clear.mockClear();
  });

  it('should save left column width to localStorage', () => {
    const testWidth = 350;
    
    // Simulate the saveColumnWidths function
    function saveColumnWidths(leftWidth: number, rightWidth: number) {
      localStorage.setItem('cam-occt-left-column-width', leftWidth.toString());
      localStorage.setItem('cam-occt-right-column-width', rightWidth.toString());
    }
    
    saveColumnWidths(testWidth, 280);
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('cam-occt-left-column-width', '350');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('cam-occt-right-column-width', '280');
  });

  it('should load column widths from localStorage', () => {
    const savedLeftWidth = '320';
    const savedRightWidth = '250';
    
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'cam-occt-left-column-width') return savedLeftWidth;
      if (key === 'cam-occt-right-column-width') return savedRightWidth;
      return null;
    });
    
    // Simulate the onMount logic
    let leftColumnWidth = 280; // Default
    let rightColumnWidth = 280; // Default
    
    const savedLeft = localStorage.getItem('cam-occt-left-column-width');
    const savedRight = localStorage.getItem('cam-occt-right-column-width');
    
    if (savedLeft) {
      leftColumnWidth = parseInt(savedLeft, 10);
    }
    if (savedRight) {
      rightColumnWidth = parseInt(savedRight, 10);
    }
    
    expect(leftColumnWidth).toBe(320);
    expect(rightColumnWidth).toBe(250);
    expect(localStorageMock.getItem).toHaveBeenCalledWith('cam-occt-left-column-width');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('cam-occt-right-column-width');
  });

  it('should handle missing localStorage values gracefully', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    // Simulate the onMount logic with no saved values
    let leftColumnWidth = 280; // Default
    let rightColumnWidth = 280; // Default
    
    const savedLeft = localStorage.getItem('cam-occt-left-column-width');
    const savedRight = localStorage.getItem('cam-occt-right-column-width');
    
    if (savedLeft) {
      leftColumnWidth = parseInt(savedLeft, 10);
    }
    if (savedRight) {
      rightColumnWidth = parseInt(savedRight, 10);
    }
    
    // Should remain at defaults
    expect(leftColumnWidth).toBe(280);
    expect(rightColumnWidth).toBe(280);
  });

  it('should respect min and max width constraints', () => {
    // Simulate the resize logic with constraints
    function calculateNewWidth(startWidth: number, deltaX: number): number {
      const newWidth = startWidth + deltaX;
      return Math.max(200, Math.min(600, newWidth)); // Min 200px, max 600px
    }
    
    // Test minimum constraint
    expect(calculateNewWidth(250, -100)).toBe(200); // Would be 150, clamped to 200
    
    // Test maximum constraint  
    expect(calculateNewWidth(550, 100)).toBe(600); // Would be 650, clamped to 600
    
    // Test normal case
    expect(calculateNewWidth(280, 50)).toBe(330); // Normal resize
  });

  it('should handle resize workflow correctly', () => {
    let isDragging = false;
    let startX = 0;
    let startWidth = 280;
    let currentWidth = 280;
    
    // Simulate mouse down
    function handleResizeStart(clientX: number) {
      isDragging = true;
      startX = clientX;
      startWidth = currentWidth;
    }
    
    // Simulate mouse move
    function handleResize(clientX: number) {
      if (!isDragging) return;
      const deltaX = clientX - startX;
      const newWidth = Math.max(200, Math.min(600, startWidth + deltaX));
      currentWidth = newWidth;
    }
    
    // Simulate mouse up
    function handleResizeEnd() {
      isDragging = false;
      localStorage.setItem('cam-occt-left-column-width', currentWidth.toString());
    }
    
    // Test the workflow
    handleResizeStart(100); // Start at x=100
    expect(isDragging).toBe(true);
    expect(startX).toBe(100);
    expect(startWidth).toBe(280);
    
    handleResize(150); // Move to x=150 (+50 pixels)
    expect(currentWidth).toBe(330); // 280 + 50
    
    handleResizeEnd();
    expect(isDragging).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('cam-occt-left-column-width', '330');
  });
});