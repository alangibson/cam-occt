// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import ResizableColumn from './ResizableColumn.svelte';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

describe('ResizableColumn Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render without errors', () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column' },
        });
        expect(container).toBeDefined();
    });

    it('should use default width when no localStorage value exists', () => {
        localStorageMock.getItem.mockReturnValue(null);

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 300 },
        });

        const column = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        expect(column.style.width).toBe('300px');
    });

    it('should load width from localStorage on mount', () => {
        localStorageMock.getItem.mockReturnValue('350');

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'saved-column' },
        });

        expect(localStorageMock.getItem).toHaveBeenCalledWith('saved-column');
        const column = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        expect(column.style.width).toBe('350px');
    });

    it('should save width to localStorage when resizing ends', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 280 },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Start resize
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });

        // Move mouse
        await fireEvent.mouseMove(document, { clientX: 150 });

        // End resize
        await fireEvent.mouseUp(document);

        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'test-column',
            expect.any(String)
        );
    });

    it('should resize with left position (normal direction)', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 280, position: 'left' },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Start resize
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });

        // Move mouse right (+50px)
        await fireEvent.mouseMove(document, { clientX: 150 });

        const column = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        expect(parseInt(column.style.width)).toBeGreaterThan(280);
    });

    it('should resize with right position (reversed direction)', async () => {
        localStorageMock.getItem.mockReturnValue(null); // Fresh start

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'right-test', width: 280, position: 'right' },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Start resize
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });

        // Move mouse right (+50px, but should decrease width for right position)
        await fireEvent.mouseMove(document, { clientX: 150 });

        const column = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        const newWidth = parseInt(column.style.width);
        expect(newWidth).toBeLessThan(280);
    });

    it('should respect minimum width constraint', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 220, minWidth: 200 },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Try to resize below minimum
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });
        await fireEvent.mouseMove(document, { clientX: 0 }); // Move far left

        const column = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        expect(parseInt(column.style.width)).toBeGreaterThanOrEqual(200);
    });

    it('should respect maximum width constraint', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column', width: 500, maxWidth: 600 },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Try to resize above maximum
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });
        await fireEvent.mouseMove(document, { clientX: 300 }); // Move far right

        const column = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        expect(parseInt(column.style.width)).toBeLessThanOrEqual(600);
    });

    it('should support keyboard resize with arrow keys', async () => {
        localStorageMock.getItem.mockReturnValue(null); // Fresh start

        const { container } = render(ResizableColumn, {
            props: {
                storageKey: 'keyboard-test',
                width: 280,
                position: 'left',
            },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Press right arrow (should increase width by 10px for left position)
        await fireEvent.keyDown(resizeHandle!, { key: 'ArrowRight' });

        const column = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        expect(column.style.width).toBe('290px');

        // Verify localStorage was updated
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'keyboard-test',
            '290'
        );
    });

    it('should handle keyboard resize for right position', async () => {
        localStorageMock.getItem.mockReturnValue(null); // Fresh start

        const { container } = render(ResizableColumn, {
            props: {
                storageKey: 'keyboard-right-test',
                width: 280,
                position: 'right',
            },
        });

        const resizeHandle = container.querySelector('.resize-handle');

        // Press right arrow (for right position, should decrease width by 10px)
        await fireEvent.keyDown(resizeHandle!, { key: 'ArrowRight' });

        const column = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        expect(column.style.width).toBe('270px');
    });

    it('should apply correct CSS classes for position', () => {
        const { container: leftContainer } = render(ResizableColumn, {
            props: { storageKey: 'test-column', position: 'left' },
        });

        const { container: rightContainer } = render(ResizableColumn, {
            props: { storageKey: 'test-column', position: 'right' },
        });

        const leftHandleColumn = leftContainer.querySelector(
            '.resize-handle-column'
        );
        const rightHandleColumn = rightContainer.querySelector(
            '.resize-handle-column'
        );

        expect(
            leftHandleColumn?.classList.contains('resize-handle-column-left')
        ).toBe(true);
        expect(
            rightHandleColumn?.classList.contains('resize-handle-column-right')
        ).toBe(true);
    });

    it('should apply dragging class during resize', async () => {
        const { container } = render(ResizableColumn, {
            props: { storageKey: 'test-column' },
        });

        const resizeHandle = container.querySelector('.resize-handle');
        const wrapper = container.querySelector('.resizable-column-wrapper');

        // Start dragging
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });

        expect(resizeHandle?.classList.contains('dragging')).toBe(true);
        expect(wrapper?.classList.contains('no-select')).toBe(true);

        // End dragging
        await fireEvent.mouseUp(document);

        expect(resizeHandle?.classList.contains('dragging')).toBe(false);
    });

    it('should collapse on double-click', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'collapse-test', width: 300 },
        });

        const resizeHandle = container.querySelector('.resize-handle');
        const wrapper = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        const content = container.querySelector('.resizable-column');

        // Double-click to collapse
        await fireEvent.dblClick(resizeHandle!);

        expect(wrapper?.classList.contains('collapsed')).toBe(true);
        expect(content?.classList.contains('hidden')).toBe(true);
        expect(wrapper?.style.width).toBe('10px'); // Collapsed width

        // Verify collapse state was saved
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'collapse-test-collapsed',
            'true'
        );
    });

    it('should expand on second double-click', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'expand-test', width: 300 },
        });

        const resizeHandle = container.querySelector('.resize-handle');
        const wrapper = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        const content = container.querySelector('.resizable-column');

        // First double-click to collapse
        await fireEvent.dblClick(resizeHandle!);

        // Second double-click to expand
        await fireEvent.dblClick(resizeHandle!);

        expect(wrapper?.classList.contains('collapsed')).toBe(false);
        expect(content?.classList.contains('hidden')).toBe(false);
        expect(wrapper?.style.width).toBe('300px'); // Restored to original width

        // Verify collapse state was saved
        expect(localStorageMock.setItem).toHaveBeenCalledWith(
            'expand-test-collapsed',
            'false'
        );
    });

    it('should prevent resizing when collapsed', async () => {
        localStorageMock.getItem.mockReturnValue(null);

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'resize-collapsed-test', width: 300 },
        });

        const resizeHandle = container.querySelector('.resize-handle');
        const wrapper = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;

        // Collapse first
        await fireEvent.dblClick(resizeHandle!);
        expect(wrapper?.style.width).toBe('10px');

        // Try to resize while collapsed
        await fireEvent.mouseDown(resizeHandle!, { clientX: 100 });
        await fireEvent.mouseMove(document, { clientX: 200 });
        await fireEvent.mouseUp(document);

        // Width should remain collapsed
        expect(wrapper?.style.width).toBe('10px');
    });

    it('should load collapsed state from localStorage', () => {
        localStorageMock.getItem.mockImplementation((key) => {
            if (key === 'collapsed-load-test') return '300';
            if (key === 'collapsed-load-test-collapsed') return 'true';
            return null;
        });

        const { container } = render(ResizableColumn, {
            props: { storageKey: 'collapsed-load-test' },
        });

        const wrapper = container.querySelector(
            '.resizable-column-wrapper'
        ) as HTMLElement;
        const content = container.querySelector('.resizable-column');

        expect(wrapper?.classList.contains('collapsed')).toBe(true);
        expect(content?.classList.contains('hidden')).toBe(true);
        expect(wrapper?.style.width).toBe('10px');
    });
});
