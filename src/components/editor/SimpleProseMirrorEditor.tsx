import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { EditorState, Transaction, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { simpleEditorSchema } from '../../services/editor/SimpleEditorSchema';
import { simpleMarkdownService } from '../../services/editor/SimpleMarkdownService';
import { InputRulesService } from '../../services/editor/InputRulesService';
import { keyboardShortcutService } from '../../services/keyboard/KeyboardShortcutService';

export interface SimpleProseMirrorEditorProps {
  content?: string;
  onChange?: (content: string, doc: ProseMirrorNode) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  onLinkDialog?: () => void;
  onShowHelp?: () => void;
  isDarkMode?: boolean;
}

export interface SimpleProseMirrorEditorRef {
  focus: () => void;
  blur: () => void;
  getContent: () => string;
  setContent: (content: string) => void;
  insertText: (text: string) => void;
  getWordCount: () => number;
}

const SimpleProseMirrorEditor = forwardRef<SimpleProseMirrorEditorRef, SimpleProseMirrorEditorProps>(
  ({ content = '', onChange, onFocus, onBlur, placeholder, className, readOnly = false, onLinkDialog, onShowHelp, isDarkMode = false }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Expose editor methods via ref
    useImperativeHandle(ref, () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      blur: () => {
        viewRef.current?.dom.blur();
      },
      getContent: () => {
        if (!viewRef.current) return '';
        return simpleMarkdownService.serializeToMarkdown(viewRef.current.state.doc);
      },
      setContent: (newContent: string) => {
        if (!viewRef.current) return;
        const doc = simpleMarkdownService.parseMarkdown(newContent, simpleEditorSchema);
        const state = EditorState.create({
          doc,
          plugins: viewRef.current.state.plugins,
        });
        viewRef.current.updateState(state);
      },
      insertText: (text: string) => {
        if (!viewRef.current) return;
        const { state, dispatch } = viewRef.current;
        const { selection } = state;
        const transaction = state.tr.insertText(text, selection.from, selection.to);
        dispatch(transaction);
      },
      getWordCount: () => {
        if (!viewRef.current) return 0;
        const text = viewRef.current.state.doc.textContent;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
      },
    }));

    // Initialize editor
    useEffect(() => {
      if (!editorRef.current) return;

      // Initializing editor

      const doc = content 
        ? simpleMarkdownService.parseMarkdown(content, simpleEditorSchema)
        : simpleEditorSchema.nodes.doc.createAndFill()!;

      // Document parsed successfully

      // Create input rules service
      const inputRulesService = new InputRulesService(simpleEditorSchema);

      // Register callback functions with shortcut service
      if (onLinkDialog) {
        keyboardShortcutService.registerLinkDialog(onLinkDialog);
      }

      // Register help callback
      if (onShowHelp) {
        keyboardShortcutService.addEventListener((shortcutId, success) => {
          if (shortcutId === 'showHelp' && success) {
            onShowHelp();
          }
        });
      }

      // Generate keymap from shortcut service
      const shortcutKeymap = keyboardShortcutService.generateProseMirrorKeymap();

      const state = EditorState.create({
        doc,
        plugins: [
          // Input rules for markdown conversion
          inputRulesService.createInputRules(),
          
          // History for undo/redo
          history(),
          
          // Keyboard shortcuts from service
          keymap(shortcutKeymap),
          
          // Enhanced keymaps with list support
          keymap({
            'Mod-z': undo,
            'Mod-y': redo,
            'Mod-Shift-z': redo,
            'Enter': (state, dispatch) => {
              const { $from, $to } = state.selection;
              
              // Handle task list items
              for (let depth = $from.depth; depth >= 0; depth--) {
                const node = $from.node(depth);
                if (node.type.name === 'task_list_item') {
                  return splitListItem(simpleEditorSchema.nodes.task_list_item)(state, dispatch);
                }
                if (node.type.name === 'list_item') {
                  return splitListItem(simpleEditorSchema.nodes.list_item)(state, dispatch);
                }
              }
              
              // Check if we're at the end of a block element (like after hr or task_list)
              const nodeAfter = $to.nodeAfter;
              const nodeBefore = $from.nodeBefore;
              
              // If we're at the end of document or after certain block elements, just insert a single paragraph
              if (!nodeAfter || nodeBefore?.type.name === 'horizontal_rule' || 
                  $from.parent.type.name === 'doc') {
                if (dispatch) {
                  const paragraph = state.schema.nodes.paragraph.create();
                  const tr = state.tr.insert($to.pos, paragraph);
                  // Position cursor inside the new paragraph
                  tr.setSelection(TextSelection.near(tr.doc.resolve($to.pos + 1)));
                  dispatch(tr);
                }
                return true;
              }
              
              // Default behavior for other cases
              return false;
            },
            'Tab': (state, dispatch) => {
              // Handle task list items
              const { $from } = state.selection;
              for (let depth = $from.depth; depth >= 0; depth--) {
                const node = $from.node(depth);
                if (node.type.name === 'task_list_item') {
                  return sinkListItem(simpleEditorSchema.nodes.task_list_item)(state, dispatch);
                }
              }
              // Handle regular list items
              return sinkListItem(simpleEditorSchema.nodes.list_item)(state, dispatch);
            },
            'Shift-Tab': (state, dispatch) => {
              // Handle task list items
              const { $from } = state.selection;
              for (let depth = $from.depth; depth >= 0; depth--) {
                const node = $from.node(depth);
                if (node.type.name === 'task_list_item') {
                  return liftListItem(simpleEditorSchema.nodes.task_list_item)(state, dispatch);
                }
              }
              // Handle regular list items
              return liftListItem(simpleEditorSchema.nodes.list_item)(state, dispatch);
            },
          }),
          
          // Base keymaps
          keymap(baseKeymap),
        ],
      });

      const view = new EditorView(editorRef.current, {
        state,
        dispatchTransaction: (transaction: Transaction) => {
          const newState = view.state.apply(transaction);
          view.updateState(newState);

          if (onChange && transaction.docChanged) {
            const markdown = simpleMarkdownService.serializeToMarkdown(newState.doc);
            // Transaction processed
            onChange(markdown, newState.doc);
          }
        },
        editable: () => !readOnly,
        attributes: {
          class: `editor-content ${className || ''}`,
          'data-placeholder': placeholder || '',
        },
        handleDOMEvents: {
          focus: () => {
            onFocus?.();
            return false;
          },
          blur: () => {
            onBlur?.();
            return false;
          },
          click: (view, event) => {
            const target = event.target as HTMLElement;
            
            // Check if clicked on a task list item
            const taskItem = target.closest('li[data-type="taskItem"]') as HTMLElement;
            if (taskItem) {
              // Get the bounding rectangles
              const taskItemRect = taskItem.getBoundingClientRect();
              const clickX = event.clientX;
              const clickY = event.clientY;
              
              // Check if click is within the checkbox area (first ~24px from left and within the first line height)
              const checkboxWidth = 24; // 16px checkbox + 8px margin
              const firstLineHeight = 24; // Approximate first line height
              
              const isInCheckboxArea = (
                clickX >= taskItemRect.left && 
                clickX <= taskItemRect.left + checkboxWidth &&
                clickY >= taskItemRect.top &&
                clickY <= taskItemRect.top + firstLineHeight
              );
              
              if (isInCheckboxArea) {
                try {
                  // Find the position of this task item in the document
                  let pos = view.posAtDOM(taskItem, 0);
                  let found = false;
                  
                  // Search for the task_list_item node
                  view.state.doc.descendants((node, nodePos) => {
                    if (found) return false;
                    
                    if (node.type.name === 'task_list_item' && nodePos <= pos && pos <= nodePos + node.nodeSize) {
                      // Toggle the checked state
                      const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
                        checked: !node.attrs.checked
                      });
                      view.dispatch(tr);
                      found = true;
                      return false;
                    }
                  });
                  
                  if (found) {
                    event.preventDefault();
                    return true;
                  }
                } catch (error) {
                  console.warn('Failed to toggle task item:', error);
                }
              }
            }
            
            return false;
          },
        },
      });

      viewRef.current = view;
      setIsReady(true);

      // Add scroll event handling for subtle scrollbar
      let scrollTimer: NodeJS.Timeout;
      const handleScroll = () => {
        if (editorRef.current) {
          editorRef.current.classList.add('scrolling');
          clearTimeout(scrollTimer);
          scrollTimer = setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.classList.remove('scrolling');
            }
          }, 1000);
        }
      };

      if (editorRef.current) {
        editorRef.current.addEventListener('scroll', handleScroll);
      }

      return () => {
        if (editorRef.current) {
          editorRef.current.removeEventListener('scroll', handleScroll);
        }
        clearTimeout(scrollTimer);
        try {
          view.destroy();
        } catch (error) {
          console.error('Error destroying ProseMirror view:', error);
        } finally {
          viewRef.current = null;
          setIsReady(false);
        }
      };
    }, []);

    // Update content when prop changes
    useEffect(() => {
      if (!viewRef.current || !isReady) return;

      const currentContent = simpleMarkdownService.serializeToMarkdown(viewRef.current.state.doc);
      if (currentContent !== content) {
        const doc = simpleMarkdownService.parseMarkdown(content, simpleEditorSchema);
        const state = EditorState.create({
          doc,
          plugins: viewRef.current.state.plugins,
        });
        viewRef.current.updateState(state);
      }
    }, [content, isReady]);

    return (
      <div 
        className="prosemirror-editor" 
        style={{
          color: isDarkMode ? '#e5e7eb' : '#1f2937',
          transition: 'color 0.3s ease',
          '--color-text': isDarkMode ? '#e5e7eb' : '#1f2937',
          '--color-text-secondary': isDarkMode ? '#9ca3af' : '#6b7280',
          '--color-bg': isDarkMode ? '#1a1a1a' : '#ffffff',
          '--color-bg-secondary': isDarkMode ? '#262626' : '#f9fafb',
          '--color-border': isDarkMode ? '#374151' : '#e5e7eb',
          '--color-primary': isDarkMode ? '#fbbf24' : '#f59e0b',
          '--color-primary-dark': isDarkMode ? '#f59e0b' : '#d97706',
          '--color-primary-light': isDarkMode ? '#93c5fd' : '#dbeafe'
        } as React.CSSProperties}
      >
        <div
          ref={editorRef}
          className={`editor-container ${readOnly ? 'read-only' : ''}`}
          style={{
            color: isDarkMode ? '#e5e7eb' : '#1f2937',
            backgroundColor: 'transparent',
            border: 'none'
          }}
        />
      </div>
    );
  }
);

SimpleProseMirrorEditor.displayName = 'SimpleProseMirrorEditor';

export default SimpleProseMirrorEditor;