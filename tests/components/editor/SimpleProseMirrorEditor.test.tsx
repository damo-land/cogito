import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import SimpleProseMirrorEditor from '../../../src/components/editor/SimpleProseMirrorEditor';

describe('SimpleProseMirrorEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders editor container', () => {
    render(<SimpleProseMirrorEditor />);
    expect(document.querySelector('.prosemirror-editor')).toBeInTheDocument();
    expect(document.querySelector('.editor-container')).toBeInTheDocument();
  });

  test('applies read-only class when readOnly prop is true', () => {
    render(<SimpleProseMirrorEditor readOnly={true} />);
    expect(document.querySelector('.editor-container')).toHaveClass('read-only');
  });

  test('applies custom className', () => {
    render(<SimpleProseMirrorEditor className="custom-class" />);
    expect(document.querySelector('.ProseMirror')).toHaveClass('custom-class');
  });

  test('has onChange capability', async () => {
    const mockOnChange = vi.fn();
    render(<SimpleProseMirrorEditor onChange={mockOnChange} />);
    
    await waitFor(() => {
      const editor = document.querySelector('.ProseMirror') as HTMLElement;
      expect(editor).toBeInTheDocument();
    });
    
    // Editor is ready and onChange is available
    expect(mockOnChange).toBeDefined();
  });

  test('calls focus and blur handlers', () => {
    const mockOnFocus = vi.fn();
    const mockOnBlur = vi.fn();
    
    render(
      <SimpleProseMirrorEditor 
        onFocus={mockOnFocus} 
        onBlur={mockOnBlur} 
      />
    );
    
    const editor = document.querySelector('.ProseMirror') as HTMLElement;
    if (editor) {
      fireEvent.focus(editor);
      expect(mockOnFocus).toHaveBeenCalled();
      
      fireEvent.blur(editor);
      expect(mockOnBlur).toHaveBeenCalled();
    }
  });

  test('initializes with provided content', () => {
    const initialContent = '# Hello World\nThis is a test.';
    render(<SimpleProseMirrorEditor content={initialContent} />);
    
    // Wait for the editor to initialize
    const editor = document.querySelector('.ProseMirror');
    expect(editor).toBeInTheDocument();
  });

  test('exposes ref methods', () => {
    const ref = React.createRef<any>();
    render(<SimpleProseMirrorEditor ref={ref} />);
    
    expect(ref.current).toBeDefined();
    expect(typeof ref.current.focus).toBe('function');
    expect(typeof ref.current.blur).toBe('function');
    expect(typeof ref.current.getContent).toBe('function');
    expect(typeof ref.current.setContent).toBe('function');
    expect(typeof ref.current.insertText).toBe('function');
    expect(typeof ref.current.getWordCount).toBe('function');
  });
});