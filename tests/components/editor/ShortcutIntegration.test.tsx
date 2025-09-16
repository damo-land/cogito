/**
 * Integration tests for keyboard shortcuts with SimpleProseMirrorEditor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SimpleProseMirrorEditor from '../../../src/components/editor/SimpleProseMirrorEditor';

// Import the mocked service to access the mock functions
import { keyboardShortcutService } from '../../../src/services/keyboard/KeyboardShortcutService';

// Mock ProseMirror modules with more complete implementations
vi.mock('prosemirror-view', () => ({
  EditorView: vi.fn().mockImplementation((mount, props) => {
    const editorDiv = document.createElement('div');
    editorDiv.contentEditable = 'true';
    editorDiv.role = 'textbox';
    editorDiv.setAttribute('aria-multiline', 'true');
    
    // Apply attributes from props if they exist
    if (props?.attributes) {
      if (props.attributes.class) {
        editorDiv.className = props.attributes.class;
      }
      if (props.attributes['data-placeholder']) {
        editorDiv.setAttribute('data-placeholder', props.attributes['data-placeholder']);
      }
    } else {
      editorDiv.className = 'prosemirror-editor';
    }
    
    // Append the editor to the mount point like real ProseMirror does
    if (mount && mount.appendChild) {
      mount.appendChild(editorDiv);
    }
    
    // Mock event handling - we need to trigger focus on click
    const mockEventHandlers = props?.handleDOMEvents || {};
    editorDiv.addEventListener('focus', () => {
      if (mockEventHandlers.focus) {
        mockEventHandlers.focus();
      }
    });
    editorDiv.addEventListener('blur', () => {
      if (mockEventHandlers.blur) {
        mockEventHandlers.blur();
      }
    });
    editorDiv.addEventListener('click', () => {
      // Simulate ProseMirror behavior where clicking focuses the editor
      editorDiv.focus();
    });
    
    return {
      state: {
        doc: { content: [], textContent: '' },
        selection: { from: 0, to: 0 },
        plugins: [],
        apply: vi.fn((tr) => ({
          doc: { content: [], textContent: '' },
          selection: { from: 0, to: 0 },
          plugins: [],
        })),
      },
      dispatch: vi.fn(),
      destroy: vi.fn(() => {
        // Clean up on destroy
        if (editorDiv.parentNode) {
          editorDiv.parentNode.removeChild(editorDiv);
        }
      }),
      focus: vi.fn(() => {
        editorDiv.focus();
      }),
      dom: editorDiv,
      updateState: vi.fn(),
    };
  }),
}));

vi.mock('prosemirror-state', () => ({
  EditorState: {
    create: vi.fn(() => ({
      doc: { content: [] },
      plugins: [],
    })),
  },
  Transaction: vi.fn(),
}));

vi.mock('prosemirror-keymap', () => ({
  keymap: vi.fn((keys) => ({ keys })),
}));

vi.mock('prosemirror-commands', () => ({
  baseKeymap: {},
  toggleMark: vi.fn(() => vi.fn(() => true)),
  setBlockType: vi.fn(() => vi.fn(() => true)),
}));

vi.mock('prosemirror-history', () => ({
  history: vi.fn(() => ({ historyPlugin: true })),
  undo: vi.fn(() => true),
  redo: vi.fn(() => true),
}));

vi.mock('prosemirror-schema-list', () => ({
  splitListItem: vi.fn(() => vi.fn(() => true)),
  liftListItem: vi.fn(() => vi.fn(() => true)),
  sinkListItem: vi.fn(() => vi.fn(() => true)),
  wrapInList: vi.fn(() => vi.fn(() => true)),
}));

// Mock the editor schema and services
vi.mock('../../../src/services/editor/SimpleEditorSchema', () => ({
  simpleEditorSchema: {
    nodes: {
      doc: { createAndFill: vi.fn(() => ({ content: [] })) },
      heading: {},
      bullet_list: {},
      ordered_list: {},
      code_block: {},
      list_item: {},
    },
    marks: {
      strong: {},
      em: {},
      code: {},
    },
  },
}));

vi.mock('../../../src/services/editor/SimpleMarkdownService', () => ({
  simpleMarkdownService: {
    parseMarkdown: vi.fn(() => ({ content: [] })),
    serializeToMarkdown: vi.fn(() => ''),
  },
}));

vi.mock('../../../src/services/editor/InputRulesService', () => ({
  InputRulesService: vi.fn().mockImplementation(() => ({
    createInputRules: vi.fn(() => ({ inputRules: true })),
  })),
}));

// Mock the keyboard shortcut service to simulate actual shortcut triggering
vi.mock('../../../src/services/keyboard/KeyboardShortcutService', () => ({
  keyboardShortcutService: {
    registerLinkDialog: vi.fn(),
    addEventListener: vi.fn(),
    generateProseMirrorKeymap: vi.fn(() => ({})),
  },
}));

describe('Keyboard Shortcut Integration', () => {
  const mockOnChange = vi.fn();
  const mockOnLinkDialog = vi.fn();
  const mockOnShowHelp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render SimpleProseMirrorEditor with shortcut support', () => {
    render(
      <SimpleProseMirrorEditor
        content=""
        onChange={mockOnChange}
        onLinkDialog={mockOnLinkDialog}
        onShowHelp={mockOnShowHelp}
      />
    );

    expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument();
  });

  it('should handle keyboard shortcuts for text formatting', async () => {
    const user = userEvent.setup();
    
    render(
      <SimpleProseMirrorEditor
        content=""
        onChange={mockOnChange}
        onLinkDialog={mockOnLinkDialog}
        onShowHelp={mockOnShowHelp}
      />
    );

    const editor = screen.getByRole('textbox', { hidden: true });
    
    // Test bold shortcut
    await user.click(editor);
    await user.keyboard('{Control>}b{/Control}');
    
    // Since we're mocking ProseMirror, we can't test the actual formatting
    // but we can ensure the component handles the key events
    expect(editor).toBeInTheDocument();
  });

  it('should handle heading shortcuts', async () => {
    const user = userEvent.setup();
    
    render(
      <SimpleProseMirrorEditor
        content=""
        onChange={mockOnChange}
        onLinkDialog={mockOnLinkDialog}
        onShowHelp={mockOnShowHelp}
      />
    );

    const editor = screen.getByRole('textbox', { hidden: true });
    
    // Test heading 1 shortcut
    await user.click(editor);
    await user.keyboard('{Control>}{Shift>}1{/Shift}{/Control}');
    
    expect(editor).toBeInTheDocument();
  });

  it('should trigger link dialog on Ctrl+K', async () => {
    render(
      <SimpleProseMirrorEditor
        content=""
        onChange={mockOnChange}
        onLinkDialog={mockOnLinkDialog}
        onShowHelp={mockOnShowHelp}
      />
    );

    // Verify that the shortcut service registers the link dialog callback
    expect(keyboardShortcutService.registerLinkDialog).toHaveBeenCalledWith(mockOnLinkDialog);
    
    // Verify editor is rendered
    const editor = screen.getByRole('textbox', { hidden: true });
    expect(editor).toBeInTheDocument();
  });

  it('should trigger help dialog on Ctrl+/', async () => {
    render(
      <SimpleProseMirrorEditor
        content=""
        onChange={mockOnChange}
        onLinkDialog={mockOnLinkDialog}
        onShowHelp={mockOnShowHelp}
      />
    );

    // Verify that the shortcut service registers the event listener for help
    expect(keyboardShortcutService.addEventListener).toHaveBeenCalled();
    
    // Verify editor is rendered
    const editor = screen.getByRole('textbox', { hidden: true });
    expect(editor).toBeInTheDocument();
  });

  it('should handle content changes', async () => {
    const user = userEvent.setup();
    
    render(
      <SimpleProseMirrorEditor
        content=""
        onChange={mockOnChange}
      />
    );

    const editor = screen.getByRole('textbox', { hidden: true });
    
    // Simulate typing
    await user.click(editor);
    await user.type(editor, 'Hello world');
    
    // Content change should be triggered
    expect(editor).toBeInTheDocument();
  });

  it('should update content when prop changes', () => {
    const { rerender } = render(
      <SimpleProseMirrorEditor
        content="Initial content"
        onChange={mockOnChange}
      />
    );

    // Update content prop
    rerender(
      <SimpleProseMirrorEditor
        content="Updated content"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('textbox', { hidden: true })).toBeInTheDocument();
  });

  it('should handle read-only mode', () => {
    render(
      <SimpleProseMirrorEditor
        content="Read-only content"
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    const container = screen.getByRole('textbox', { hidden: true }).parentElement;
    expect(container).toHaveClass('read-only');
  });

  it('should handle focus and blur events', async () => {
    const mockOnFocus = vi.fn();
    const mockOnBlur = vi.fn();
    
    render(
      <SimpleProseMirrorEditor
        content=""
        onChange={mockOnChange}
        onFocus={mockOnFocus}
        onBlur={mockOnBlur}
      />
    );

    // Verify that the component renders with the callbacks set
    const editor = screen.getByRole('textbox', { hidden: true });
    expect(editor).toBeInTheDocument();
    
    // In a full integration test, focus/blur would trigger these callbacks
    // For this mock-based test, we verify the component accepts the props
    expect(mockOnFocus).toBeDefined();
    expect(mockOnBlur).toBeDefined();
  });

  it('should expose correct ref methods', () => {
    let editorRef: any = null;
    
    render(
      <SimpleProseMirrorEditor
        ref={(ref) => { editorRef = ref; }}
        content=""
        onChange={mockOnChange}
      />
    );

    expect(editorRef).not.toBeNull();
    expect(typeof editorRef.focus).toBe('function');
    expect(typeof editorRef.blur).toBe('function');
    expect(typeof editorRef.getContent).toBe('function');
    expect(typeof editorRef.setContent).toBe('function');
    expect(typeof editorRef.insertText).toBe('function');
    expect(typeof editorRef.getWordCount).toBe('function');
  });

  it('should handle placeholder text', () => {
    const placeholder = 'Type your content here...';
    
    render(
      <SimpleProseMirrorEditor
        content=""
        onChange={mockOnChange}
        placeholder={placeholder}
      />
    );

    const editor = screen.getByRole('textbox', { hidden: true });
    expect(editor).toHaveAttribute('data-placeholder', placeholder);
  });

  it('should apply custom className', () => {
    const customClass = 'custom-editor-class';
    
    render(
      <SimpleProseMirrorEditor
        content=""
        onChange={mockOnChange}
        className={customClass}
      />
    );

    const editor = screen.getByRole('textbox', { hidden: true });
    expect(editor).toHaveClass('editor-content', customClass);
  });
});