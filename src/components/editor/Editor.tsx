import React, { useCallback, useEffect, useState } from 'react';
import SimpleProseMirrorEditor from './SimpleProseMirrorEditor';
import Toolbar from './Toolbar';
import ShortcutHelp from './ShortcutHelp';
import { useEditor } from '../../hooks/useEditor';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import '../../styles/editor.css';

export interface EditorProps {
  initialContent?: string;
  onSave?: (content: string) => Promise<void>;
  onContentChange?: (content: string, wordCount: number) => void;
  autoSaveDelay?: number;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  showToolbar?: boolean;
  showStatus?: boolean;
  isDarkMode?: boolean;
}

const Editor: React.FC<EditorProps> = ({
  initialContent = '',
  onSave,
  onContentChange,
  autoSaveDelay = 2000,
  placeholder = 'Start writing your markdown...',
  className = '',
  readOnly = false,
  showToolbar = true,
  showStatus = true,
  isDarkMode = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  
  // Initialize keyboard shortcuts hook with global listening for help command
  useKeyboardShortcuts({
    enableGlobalListening: true,
    onShortcutExecuted: (shortcutId, success) => {
      if (shortcutId === 'showHelp' && success) {
        setShowShortcutHelp(true);
      }
    },
  });

  const {
    editorState,
    editorRef,
    editorView,
    setEditorView,
    handleContentChange,
    saveContent,
    focus,
  } = useEditor({
    initialContent,
    onSave,
    autoSaveDelay,
    onError: (error) => {
      console.error('Editor error:', error);
    },
  });

  // Handle content changes
  const handleEditorContentChange = useCallback((content: string, doc: any) => {
    handleContentChange(content, doc);
    onContentChange?.(content, editorState.wordCount);
  }, [handleContentChange, onContentChange, editorState.wordCount]);

  // Handle focus events
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (!isFocused) return;

      // Cmd/Ctrl + S to save
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        if (onSave && editorState.isModified) {
          try {
            await saveContent();
          } catch (error) {
            console.error('Manual save failed:', error);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFocused, onSave, editorState.isModified, saveContent]);

  // Format last saved time
  const formatLastSaved = (date: Date | null): string => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div style={{ 
      position: 'relative',
      width: '100%', 
      height: '100%',
      padding: 0,
      margin: 0,
      border: 'none'
    }}>      
      <SimpleProseMirrorEditor
        ref={editorRef}
        content={editorState.content}
        onChange={handleEditorContentChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        readOnly={readOnly}
        className="editor-minimal"
        onShowHelp={() => setShowShortcutHelp(true)}
        isDarkMode={isDarkMode}
      />


      <ShortcutHelp
        isOpen={showShortcutHelp}
        onClose={() => setShowShortcutHelp(false)}
      />
    </div>
  );
};

export default Editor;