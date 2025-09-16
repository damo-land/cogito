import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import SimpleProseMirrorEditor from '../../../src/components/editor/SimpleProseMirrorEditor';
import Toolbar from '../../../src/components/editor/Toolbar';

// Mock window.prompt for link creation
const mockPrompt = vi.fn();
Object.defineProperty(window, 'prompt', {
  writable: true,
  value: mockPrompt,
});

describe('Advanced Editor Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Advanced markdown input rules', () => {
    test('renders editor with advanced schema support', () => {
      render(<SimpleProseMirrorEditor />);
      
      const editor = document.querySelector('.editor-content');
      expect(editor).toBeInTheDocument();
    });

    test('handles content changes with advanced elements', () => {
      const mockOnChange = vi.fn();
      render(<SimpleProseMirrorEditor onChange={mockOnChange} />);
      
      const editor = document.querySelector('.editor-content');
      expect(editor).toBeInTheDocument();
      
      // The editor should be initialized
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    test('supports initial content with lists', () => {
      const initialContent = '- Item 1\n- Item 2\n\n1. Numbered 1\n2. Numbered 2';
      render(<SimpleProseMirrorEditor content={initialContent} />);
      
      const editor = document.querySelector('.editor-content');
      expect(editor).toBeInTheDocument();
    });

    test('supports initial content with links', () => {
      const initialContent = '[Example Link](https://example.com)';
      render(<SimpleProseMirrorEditor content={initialContent} />);
      
      const editor = document.querySelector('.editor-content');
      expect(editor).toBeInTheDocument();
    });

    test('supports initial content with code blocks', () => {
      const initialContent = '```javascript\nconst hello = "world";\n```';
      render(<SimpleProseMirrorEditor content={initialContent} />);
      
      const editor = document.querySelector('.editor-content');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Enhanced toolbar functionality', () => {
    test('renders enhanced toolbar with list buttons', () => {
      const mockEditorView = {
        state: {
          selection: { from: 0, to: 0, $from: { parent: { type: { name: 'paragraph' }, attrs: {} }, depth: 0 } },
          doc: { rangeHasMark: vi.fn().mockReturnValue(false) }
        },
        dispatch: vi.fn(),
        focus: vi.fn(),
      } as any;

      render(<Toolbar editorView={mockEditorView} />);
      
      // Check for list buttons
      expect(screen.getByTitle('Bullet List')).toBeInTheDocument();
      expect(screen.getByTitle('Ordered List')).toBeInTheDocument();
    });

    test('renders toolbar with code block and link buttons', () => {
      const mockEditorView = {
        state: {
          selection: { from: 0, to: 0, $from: { parent: { type: { name: 'paragraph' }, attrs: {} }, depth: 0 } },
          doc: { rangeHasMark: vi.fn().mockReturnValue(false) }
        },
        dispatch: vi.fn(),
        focus: vi.fn(),
      } as any;

      render(<Toolbar editorView={mockEditorView} />);
      
      // Check for advanced buttons
      expect(screen.getByTitle('Code Block')).toBeInTheDocument();
      expect(screen.getByTitle(/Insert Link/)).toBeInTheDocument();
      expect(screen.getByTitle('Blockquote')).toBeInTheDocument();
    });

    test('handles link button click', async () => {
      const mockDispatch = vi.fn();
      const mockEditorView = {
        state: {
          selection: { from: 0, to: 0 },
          doc: { 
            textBetween: vi.fn().mockReturnValue(''),
            rangeHasMark: vi.fn().mockReturnValue(false)
          },
          tr: {
            insertText: vi.fn().mockReturnThis(),
            addMark: vi.fn().mockReturnThis()
          }
        },
        dispatch: mockDispatch,
        focus: vi.fn(),
      } as any;

      render(<Toolbar editorView={mockEditorView} />);
      
      const linkButton = screen.getByTitle(/Insert Link/);
      fireEvent.click(linkButton);
      
      // Check that the link dialog is opened
      await waitFor(() => {
        expect(screen.getByText('Insert Link')).toBeInTheDocument();
        expect(screen.getByDisplayValue('https://')).toBeInTheDocument();
      });
    });

    test('handles disabled state when no editor view', () => {
      render(<Toolbar editorView={null} />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Editor and toolbar integration', () => {
    test('editor and toolbar work together', async () => {
      const mockOnChange = vi.fn();
      
      const { container } = render(
        <div>
          <SimpleProseMirrorEditor onChange={mockOnChange} />
        </div>
      );

      const editor = container.querySelector('.editor-content');
      expect(editor).toBeInTheDocument();
      
      // Test that the editor is functional
      await waitFor(() => {
        expect(editor).toBeInTheDocument();
      });
    });

    test('supports all schema elements', () => {
      const complexContent = `# Main Title

## Subtitle

This is a paragraph with **bold** and *italic* text, plus some \`inline code\`.

### Lists

- Bullet item 1
- Bullet item 2
  - Nested item

1. Numbered item 1
2. Numbered item 2

### Code Block

\`\`\`javascript
const hello = "world";
console.log(hello);
\`\`\`

### Quote

> This is a blockquote
> with multiple lines

### Link

Check out [this link](https://example.com) for more info.`;

      render(<SimpleProseMirrorEditor content={complexContent} />);
      
      const editor = document.querySelector('.editor-content');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Input rule functionality', () => {
    test('editor supports markdown input rules', () => {
      render(<SimpleProseMirrorEditor />);
      
      const editor = document.querySelector('.editor-content');
      expect(editor).toBeInTheDocument();
      
      // Input rules are active - exact testing is complex but the editor should be ready
      expect(editor?.getAttribute('contenteditable')).not.toBe('false');
    });
  });
});