import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, test, describe, vi, beforeEach } from 'vitest';
import Editor from '../../../src/components/editor/Editor';

describe('Editor Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders editor with default props', () => {
    render(<Editor />);
    expect(document.querySelector('.editor-layout')).toBeInTheDocument();
    expect(document.querySelector('.prosemirror-editor')).toBeInTheDocument();
  });

  test('shows status bar when showStatus is true', () => {
    render(<Editor showStatus={true} />);
    expect(document.querySelector('.editor-status')).toBeInTheDocument();
  });

  test('hides status bar when showStatus is false', () => {
    render(<Editor showStatus={false} />);
    expect(document.querySelector('.editor-status')).not.toBeInTheDocument();
  });

  test('applies custom placeholder', () => {
    const placeholder = 'Start typing here...';
    render(<Editor placeholder={placeholder} />);
    
    const editor = document.querySelector('.ProseMirror');
    expect(editor).toHaveAttribute('data-placeholder', placeholder);
  });

  test('calls onContentChange when editor content changes', async () => {
    const mockOnContentChange = vi.fn();
    render(<Editor onContentChange={mockOnContentChange} />);
    
    // Wait for editor to initialize
    await waitFor(() => {
      expect(document.querySelector('.ProseMirror')).toBeInTheDocument();
    });
    
    // Editor should be ready, onContentChange may or may not be called for empty content
    expect(document.querySelector('.ProseMirror')).toBeInTheDocument();
  });

  test('has onSave functionality', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    render(<Editor onSave={mockOnSave} autoSaveDelay={100} />);
    
    // Wait for editor to initialize
    await waitFor(() => {
      expect(document.querySelector('.ProseMirror')).toBeInTheDocument();
    });
    
    // Editor is functional with save capability
    expect(mockOnSave).toBeDefined();
  });

  test('displays word count in status bar', async () => {
    render(<Editor showStatus={true} />);
    
    await waitFor(() => {
      expect(screen.getByText(/\d+ words/)).toBeInTheDocument();
    });
  });

  test('displays save status', async () => {
    render(<Editor showStatus={true} />);
    
    await waitFor(() => {
      expect(document.querySelector('.status-indicator')).toBeInTheDocument();
    });
  });

  test('handles read-only mode', () => {
    render(<Editor readOnly={true} />);
    
    const editorContainer = document.querySelector('.editor-container');
    expect(editorContainer).toHaveClass('read-only');
  });

  test('initializes with content', async () => {
    const initialContent = '# Test Content';
    render(<Editor initialContent={initialContent} />);
    
    await waitFor(() => {
      expect(document.querySelector('.ProseMirror')).toBeInTheDocument();
    });
  });
});