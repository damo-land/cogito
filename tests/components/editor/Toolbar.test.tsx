import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import { EditorView } from 'prosemirror-view';
import { EditorState } from 'prosemirror-state';
import Toolbar from '../../../src/components/editor/Toolbar';
import { simpleEditorSchema } from '../../../src/services/editor/SimpleEditorSchema';

// Mock ProseMirror EditorView
const createMockEditorView = (overrides: any = {}): Partial<EditorView> => ({
  state: {
    selection: { 
      from: 0, 
      to: 0,
      $from: {
        parent: {
          type: { name: 'paragraph' },
          attrs: {},
        },
      },
    },
    doc: {
      rangeHasMark: vi.fn().mockReturnValue(false),
    },
    ...(overrides.state || {}),
  },
  dispatch: vi.fn().mockReturnValue(true),
  focus: vi.fn(),
  ...overrides,
} as Partial<EditorView>);

describe('Toolbar', () => {
  let mockEditorView: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEditorView = createMockEditorView();
  });

  test('renders toolbar with all button groups', () => {
    render(<Toolbar editorView={mockEditorView} />);
    
    // Check for formatting buttons
    expect(screen.getByTitle('Bold (Ctrl+b)')).toBeInTheDocument();
    expect(screen.getByTitle('Italic (Ctrl+i)')).toBeInTheDocument();
    expect(screen.getByTitle('Inline Code (Ctrl+Shift+c)')).toBeInTheDocument();
    
    // Check for heading buttons
    expect(screen.getByTitle('Heading 1 (Ctrl+Shift+1)')).toBeInTheDocument();
    expect(screen.getByTitle('Heading 2')).toBeInTheDocument();
    expect(screen.getByTitle('Heading 3')).toBeInTheDocument();
    expect(screen.getByTitle('Paragraph')).toBeInTheDocument();
    
    // Check for history buttons
    expect(screen.getByTitle('Undo (Ctrl+z)')).toBeInTheDocument();
    expect(screen.getByTitle('Redo (Ctrl+y)')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(<Toolbar editorView={mockEditorView} className="custom-toolbar" />);
    expect(document.querySelector('.editor-toolbar')).toHaveClass('custom-toolbar');
  });

  test('handles button click without throwing errors', () => {
    render(<Toolbar editorView={mockEditorView} />);
    
    const boldButton = screen.getByTitle('Bold (Ctrl+b)');
    expect(() => fireEvent.click(boldButton)).not.toThrow();
  });

  test('shows active state for bold button when text is bold', () => {
    const mockView = createMockEditorView({
      state: {
        selection: { from: 0, to: 5 },
        doc: {
          rangeHasMark: vi.fn().mockImplementation((from, to, mark) => 
            mark === simpleEditorSchema.marks.strong
          ),
        },
      },
    });

    render(<Toolbar editorView={mockView as EditorView} />);
    
    const boldButton = screen.getByTitle('Bold (Ctrl+b)');
    expect(boldButton).toHaveClass('active');
  });

  test('shows active state for heading buttons', () => {
    const mockView = createMockEditorView({
      state: {
        selection: {
          from: 0,
          to: 5,
          $from: {
            parent: {
              type: simpleEditorSchema.nodes.heading,
              attrs: { level: 1 },
            },
          },
        },
        doc: {
          rangeHasMark: vi.fn().mockReturnValue(false),
        },
      },
    });

    render(<Toolbar editorView={mockView as EditorView} />);
    
    const h1Button = screen.getByTitle('Heading 1 (Ctrl+Shift+1)');
    expect(h1Button).toHaveClass('active');
  });

  test('disables buttons when editor view is null', () => {
    render(<Toolbar editorView={null} />);
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  test('handles button action errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mockView = createMockEditorView({
      dispatch: vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      }),
    });

    render(<Toolbar editorView={mockView as EditorView} />);
    
    const boldButton = screen.getByTitle('Bold (Ctrl+b)');
    fireEvent.click(boldButton);
    
    expect(consoleSpy).toHaveBeenCalledWith('Toolbar action failed for bold:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  test('handles active state check errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const mockView = createMockEditorView({
      state: {
        selection: { from: 0, to: 5 },
        doc: {
          rangeHasMark: vi.fn().mockImplementation(() => {
            throw new Error('Test error');
          }),
        },
      },
    });

    render(<Toolbar editorView={mockView as EditorView} />);
    
    // Should not throw and button should not be active
    const boldButton = screen.getByTitle('Bold (Ctrl+b)');
    expect(boldButton).not.toHaveClass('active');
    
    expect(consoleSpy).toHaveBeenCalledWith('Toolbar active check failed for bold:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  test('includes proper accessibility attributes', () => {
    render(<Toolbar editorView={mockEditorView} />);
    
    const boldButton = screen.getByTitle('Bold (Ctrl+b)');
    expect(boldButton).toHaveAttribute('aria-label', 'Bold');
    expect(boldButton).toHaveAttribute('type', 'button');
  });

  test('groups buttons logically with separators', () => {
    render(<Toolbar editorView={mockEditorView} />);
    
    const separators = document.querySelectorAll('.toolbar-separator');
    expect(separators).toHaveLength(4); // Between formatting, headings, lists, advanced, and history groups
  });
});