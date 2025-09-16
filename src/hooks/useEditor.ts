import { useCallback, useRef, useState, useEffect } from 'react';
import { EditorView } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { SimpleProseMirrorEditorRef } from '../components/editor/SimpleProseMirrorEditor';

export interface EditorState {
  content: string;
  wordCount: number;
  isModified: boolean;
  isLoading: boolean;
  error: string | null;
  lastSaved: Date | null;
}

export interface UseEditorOptions {
  initialContent?: string;
  onSave?: (content: string) => Promise<void>;
  autoSaveDelay?: number;
  onError?: (error: Error) => void;
}

export interface UseEditorReturn {
  editorState: EditorState;
  editorRef: React.RefObject<SimpleProseMirrorEditorRef>;
  editorView: EditorView | null;
  setEditorView: (view: EditorView | null) => void;
  handleContentChange: (content: string, doc: ProseMirrorNode) => void;
  saveContent: () => Promise<void>;
  resetContent: () => void;
  setContent: (content: string) => void;
  insertText: (text: string) => void;
  focus: () => void;
  blur: () => void;
}

export const useEditor = (options: UseEditorOptions = {}): UseEditorReturn => {
  const {
    initialContent = '',
    onSave,
    autoSaveDelay = 2000,
    onError,
  } = options;

  const editorRef = useRef<SimpleProseMirrorEditorRef>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [editorState, setEditorState] = useState<EditorState>({
    content: initialContent,
    wordCount: 0,
    isModified: false,
    isLoading: false,
    error: null,
    lastSaved: null,
  });

  // Handle content changes
  const handleContentChange = useCallback((content: string, doc: ProseMirrorNode) => {
    const wordCount = doc.textContent.trim().split(/\s+/).filter(word => word.length > 0).length;

    console.log('🔄 useEditor handleContentChange:', {
      length: content.length,
      preview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      lines: content.split('\n').length,
      wordCount,
      isModified: content !== initialContent
    });

    setEditorState(prev => ({
      ...prev,
      content,
      wordCount,
      isModified: content !== initialContent,
      error: null,
    }));

    // Auto-save
    if (onSave && autoSaveDelay > 0) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(async () => {
        try {
          await onSave(content);
          setEditorState(prev => ({
            ...prev,
            lastSaved: new Date(),
            isModified: false,
          }));
        } catch (error) {
          console.error('Auto-save failed:', error);
          setEditorState(prev => ({
            ...prev,
            error: 'Failed to auto-save content',
          }));
          onError?.(error as Error);
        }
      }, autoSaveDelay);
    }
  }, [initialContent, onSave, autoSaveDelay, onError]);

  // Manual save
  const saveContent = useCallback(async () => {
    if (!onSave) return;

    setEditorState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await onSave(editorState.content);
      setEditorState(prev => ({
        ...prev,
        isLoading: false,
        lastSaved: new Date(),
        isModified: false,
      }));
    } catch (error) {
      console.error('Save failed:', error);
      setEditorState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to save content',
      }));
      onError?.(error as Error);
      throw error;
    }
  }, [editorState.content, onSave, onError]);

  // Reset content
  const resetContent = useCallback(() => {
    setEditorState({
      content: initialContent,
      wordCount: 0,
      isModified: false,
      isLoading: false,
      error: null,
      lastSaved: null,
    });
    editorRef.current?.setContent(initialContent);
  }, [initialContent]);

  // Set content programmatically
  const setContent = useCallback((content: string) => {
    setEditorState(prev => ({
      ...prev,
      content,
      isModified: content !== initialContent,
    }));
    editorRef.current?.setContent(content);
  }, [initialContent]);

  // Insert text at cursor
  const insertText = useCallback((text: string) => {
    editorRef.current?.insertText(text);
  }, []);

  // Focus editor
  const focus = useCallback(() => {
    editorRef.current?.focus();
  }, []);

  // Blur editor
  const blur = useCallback(() => {
    editorRef.current?.blur();
  }, []);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Update word count when content changes
  useEffect(() => {
    if (editorRef.current) {
      const count = editorRef.current.getWordCount();
      setEditorState(prev => ({ ...prev, wordCount: count }));
    }
  }, [editorState.content]);

  return {
    editorState,
    editorRef,
    editorView,
    setEditorView,
    handleContentChange,
    saveContent,
    resetContent,
    setContent,
    insertText,
    focus,
    blur,
  };
};

export default useEditor;