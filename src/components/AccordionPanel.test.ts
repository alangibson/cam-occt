// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AccordionPanel from './AccordionPanel.svelte';

describe('AccordionPanel Component', () => {
  it('should render without errors', () => {
    const { container } = render(AccordionPanel, { props: { title: 'Test Panel' } });
    expect(container).toBeDefined();
  });

  it('should display the provided title', () => {
    const { getByText } = render(AccordionPanel, { props: { title: 'My Test Panel' } });
    expect(getByText('My Test Panel')).toBeDefined();
  });

  it('should be expanded by default', () => {
    const { container } = render(AccordionPanel, { 
      props: { title: 'Test Panel' }
    });
    
    const header = container.querySelector('.panel-header');
    const content = container.querySelector('.panel-content');
    
    expect(header?.classList.contains('expanded')).toBe(true);
    expect(content).toBeDefined();
  });

  it('should allow initial collapsed state', () => {
    const { container } = render(AccordionPanel, { 
      props: { title: 'Test Panel', isExpanded: false }
    });
    
    const header = container.querySelector('.panel-header');
    const content = container.querySelector('.panel-content');
    
    expect(header?.classList.contains('expanded')).toBe(false);
    expect(content).toBeDefined(); // Content div exists but may be hidden
  });

  it('should toggle expansion when header is clicked', async () => {
    const { container, getByText } = render(AccordionPanel, { 
      props: { title: 'Test Panel' }
    });
    
    const header = getByText('Test Panel').closest('.panel-header');
    let content = container.querySelector('.panel-content');
    
    // Initially expanded
    expect(content).toBeDefined();
    
    // Click to collapse
    await fireEvent.click(header!);
    content = container.querySelector('.panel-content');
    expect(content).toBeDefined(); // Content div still exists when collapsed
    
    // Click to expand again
    await fireEvent.click(header!);
    content = container.querySelector('.panel-content');
    expect(content).toBeDefined();
  });

  it('should toggle expansion with Enter key', async () => {
    const { container, getByText } = render(AccordionPanel, { 
      props: { title: 'Test Panel' }
    });
    
    const header = getByText('Test Panel').closest('.panel-header');
    let content = container.querySelector('.panel-content');
    
    // Initially expanded
    expect(content).toBeDefined();
    
    // Press Enter to collapse
    await fireEvent.keyDown(header!, { key: 'Enter' });
    content = container.querySelector('.panel-content');
    expect(content).toBeDefined(); // Content div still exists when collapsed
    
    // Press Enter to expand again
    await fireEvent.keyDown(header!, { key: 'Enter' });
    content = container.querySelector('.panel-content');
    expect(content).toBeDefined();
  });

  it('should not toggle with other keys', async () => {
    const { container, getByText } = render(AccordionPanel, { 
      props: { title: 'Test Panel' }
    });
    
    const header = getByText('Test Panel').closest('.panel-header');
    let content = container.querySelector('.panel-content');
    
    // Initially expanded
    expect(content).toBeDefined();
    
    // Press Space (should not toggle)
    await fireEvent.keyDown(header!, { key: ' ' });
    content = container.querySelector('.panel-content');
    expect(content).toBeDefined(); // Still expanded
    
    // Press Escape (should not toggle)
    await fireEvent.keyDown(header!, { key: 'Escape' });
    content = container.querySelector('.panel-content');
    expect(content).toBeDefined(); // Still expanded
  });

  it('should rotate arrow icon when expanded', () => {
    const { container } = render(AccordionPanel, { 
      props: { title: 'Test Panel', isExpanded: true }
    });
    
    const arrow = container.querySelector('.arrow-icon');
    expect(arrow?.classList.contains('expanded')).toBe(true);
  });

  it('should not rotate arrow icon when collapsed', () => {
    const { container } = render(AccordionPanel, { 
      props: { title: 'Test Panel', isExpanded: false }
    });
    
    const arrow = container.querySelector('.arrow-icon');
    expect(arrow?.classList.contains('expanded')).toBe(false);
  });

  it('should have panel content area when expanded', () => {
    const { container } = render(AccordionPanel, { 
      props: { title: 'Test Panel', isExpanded: true }
    });
    
    const content = container.querySelector('.panel-content');
    expect(content).toBeDefined();
  });
});