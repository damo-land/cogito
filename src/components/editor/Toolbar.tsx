import React, { useState } from 'react';
import { EditorView } from 'prosemirror-view';
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { wrapInList, liftListItem } from 'prosemirror-schema-list';
import { simpleEditorSchema } from '../../services/editor/SimpleEditorSchema';
import LinkDialog from '../ui/LinkDialog';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { keysToDisplayString } from '../../services/keyboard/ShortcutUtils';

export interface ToolbarProps {
  editorView?: EditorView | null;
  className?: string;
}

export interface ToolbarButton {
  id: string;
  label: string;
  icon: string;
  title: string;
  action: (view: EditorView) => boolean;
  isActive?: (view: EditorView) => boolean;
  isDisabled?: (view: EditorView) => boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({ editorView, className = '' }) => {
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [pendingLinkAction, setPendingLinkAction] = useState<((href: string) => void) | null>(null);
  const { shortcuts } = useKeyboardShortcuts();

  // Helper function to get shortcut display text
  const getShortcutText = (commandId: string): string => {
    const shortcut = Object.values(shortcuts).find(s => s.command === commandId);
    return shortcut ? keysToDisplayString(shortcut.keys) : '';
  };

  const toolbarButtons: ToolbarButton[] = [
    // Text formatting
    {
      id: 'bold',
      label: 'Bold',
      icon: '𝐁',
      title: `Bold${getShortcutText('toggleBold') ? ` (${getShortcutText('toggleBold')})` : ''}`,
      action: (view) => toggleMark(simpleEditorSchema.marks.strong)(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { from, to } = state.selection;
        return state.doc.rangeHasMark(from, to, simpleEditorSchema.marks.strong);
      },
    },
    {
      id: 'italic',
      label: 'Italic',
      icon: '𝐼',
      title: `Italic${getShortcutText('toggleItalic') ? ` (${getShortcutText('toggleItalic')})` : ''}`,
      action: (view) => toggleMark(simpleEditorSchema.marks.em)(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { from, to } = state.selection;
        return state.doc.rangeHasMark(from, to, simpleEditorSchema.marks.em);
      },
    },
    {
      id: 'code',
      label: 'Code',
      icon: '⟨⟩',
      title: `Inline Code${getShortcutText('toggleInlineCode') ? ` (${getShortcutText('toggleInlineCode')})` : ''}`,
      action: (view) => toggleMark(simpleEditorSchema.marks.code)(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { from, to } = state.selection;
        return state.doc.rangeHasMark(from, to, simpleEditorSchema.marks.code);
      },
    },

    // Headings
    {
      id: 'heading1',
      label: 'H1',
      icon: 'H₁',
      title: `Heading 1${getShortcutText('setHeading1') ? ` (${getShortcutText('setHeading1')})` : ''}`,
      action: (view) => setBlockType(simpleEditorSchema.nodes.heading, { level: 1 })(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { $from } = state.selection;
        return $from?.parent?.type === simpleEditorSchema.nodes.heading && $from?.parent?.attrs?.level === 1;
      },
    },
    {
      id: 'heading2',
      label: 'H2',
      icon: 'H₂',
      title: 'Heading 2',
      action: (view) => setBlockType(simpleEditorSchema.nodes.heading, { level: 2 })(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { $from } = state.selection;
        return $from?.parent?.type === simpleEditorSchema.nodes.heading && $from?.parent?.attrs?.level === 2;
      },
    },
    {
      id: 'heading3',
      label: 'H3',
      icon: 'H₃',
      title: 'Heading 3',
      action: (view) => setBlockType(simpleEditorSchema.nodes.heading, { level: 3 })(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { $from } = state.selection;
        return $from?.parent?.type === simpleEditorSchema.nodes.heading && $from?.parent?.attrs?.level === 3;
      },
    },

    // Lists
    {
      id: 'bulletList',
      label: 'Bullet List',
      icon: '•',
      title: 'Bullet List',
      action: (view) => wrapInList(simpleEditorSchema.nodes.bullet_list)(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { $from } = state.selection;
        if (!$from || typeof $from.node !== 'function') return false;
        // Check if we're inside a bullet list
        try {
          for (let i = $from.depth; i >= 0; i--) {
            if ($from.node(i).type === simpleEditorSchema.nodes.bullet_list) {
              return true;
            }
          }
        } catch (error) {
          return false;
        }
        return false;
      },
    },
    {
      id: 'orderedList',
      label: 'Ordered List',
      icon: '1.',
      title: 'Ordered List',
      action: (view) => wrapInList(simpleEditorSchema.nodes.ordered_list)(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { $from } = state.selection;
        if (!$from || typeof $from.node !== 'function') return false;
        // Check if we're inside an ordered list
        try {
          for (let i = $from.depth; i >= 0; i--) {
            if ($from.node(i).type === simpleEditorSchema.nodes.ordered_list) {
              return true;
            }
          }
        } catch (error) {
          return false;
        }
        return false;
      },
    },

    // Code block
    {
      id: 'codeBlock',
      label: 'Code Block',
      icon: '{}',
      title: 'Code Block',
      action: (view) => setBlockType(simpleEditorSchema.nodes.code_block)(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { $from } = state.selection;
        return $from?.parent?.type === simpleEditorSchema.nodes.code_block;
      },
    },

    // Link
    {
      id: 'link',
      label: 'Link',
      icon: '🔗',
      title: `Insert Link${getShortcutText('insertLink') ? ` (${getShortcutText('insertLink')})` : ''}`,
      action: (view) => {
        const { state, dispatch } = view;
        const { from, to } = state.selection;
        
        // Get selected text or empty string
        const selectedText = state.doc.textBetween(from, to);
        
        // Set up the pending action and open dialog
        setPendingLinkAction(() => (href: string) => {
          const linkMark = simpleEditorSchema.marks.link.create({ href });
          
          if (selectedText) {
            // Apply link to selected text
            dispatch(state.tr.addMark(from, to, linkMark));
          } else {
            // Insert new link with URL as text
            const linkText = href;
            dispatch(state.tr.insertText(linkText, from, from).addMark(from, from + linkText.length, linkMark));
          }
        });
        
        setLinkDialogOpen(true);
        
        return true;
      },
      isActive: (view) => {
        const { state } = view;
        const { from, to } = state.selection;
        return state.doc.rangeHasMark(from, to, simpleEditorSchema.marks.link);
      },
    },

    // Blockquote
    {
      id: 'blockquote',
      label: 'Quote',
      icon: '❝',
      title: 'Blockquote',
      action: (view) => wrapIn(simpleEditorSchema.nodes.blockquote)(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { $from } = state.selection;
        if (!$from || typeof $from.node !== 'function') return false;
        // Check if we're inside a blockquote
        try {
          for (let i = $from.depth; i >= 0; i--) {
            if ($from.node(i).type === simpleEditorSchema.nodes.blockquote) {
              return true;
            }
          }
        } catch (error) {
          return false;
        }
        return false;
      },
    },

    // Paragraph
    {
      id: 'paragraph',
      label: 'P',
      icon: '¶',
      title: 'Paragraph',
      action: (view) => setBlockType(simpleEditorSchema.nodes.paragraph)(view.state, view.dispatch),
      isActive: (view) => {
        const { state } = view;
        const { $from } = state.selection;
        return $from?.parent?.type === simpleEditorSchema.nodes.paragraph;
      },
    },

    // History
    {
      id: 'undo',
      label: 'Undo',
      icon: '↶',
      title: `Undo${getShortcutText('undo') ? ` (${getShortcutText('undo')})` : ''}`,
      action: (view) => undo(view.state, view.dispatch),
      isDisabled: (view) => !undo(view.state),
    },
    {
      id: 'redo',
      label: 'Redo',
      icon: '↷',
      title: `Redo${getShortcutText('redo') ? ` (${getShortcutText('redo')})` : ''}`,
      action: (view) => redo(view.state, view.dispatch),
      isDisabled: (view) => !redo(view.state),
    },
  ];

  const handleButtonClick = (button: ToolbarButton) => {
    if (!editorView) return;
    
    try {
      button.action(editorView);
      editorView.focus();
    } catch (error) {
      console.error(`Toolbar action failed for ${button.id}:`, error);
    }
  };

  const isButtonActive = (button: ToolbarButton): boolean => {
    if (!editorView || !button.isActive) return false;
    try {
      return button.isActive(editorView);
    } catch (error) {
      console.error(`Toolbar active check failed for ${button.id}:`, error);
      return false;
    }
  };

  const isButtonDisabled = (button: ToolbarButton): boolean => {
    if (!editorView) return true;
    if (!button.isDisabled) return false;
    try {
      return button.isDisabled(editorView);
    } catch (error) {
      console.error(`Toolbar disabled check failed for ${button.id}:`, error);
      return false;
    }
  };

  const handleLinkConfirm = (href: string) => {
    if (pendingLinkAction) {
      pendingLinkAction(href);
      setPendingLinkAction(null);
    }
    setLinkDialogOpen(false);
  };

  const handleLinkCancel = () => {
    setPendingLinkAction(null);
    setLinkDialogOpen(false);
  };

  return (
    <>
      <div className={`editor-toolbar ${className}`}>
      <div className="toolbar-group">
        {toolbarButtons.filter(btn => ['bold', 'italic', 'code'].includes(btn.id)).map((button) => (
          <button
            key={button.id}
            type="button"
            className={`toolbar-button ${isButtonActive(button) ? 'active' : ''} ${isButtonDisabled(button) ? 'disabled' : ''}`}
            title={button.title}
            onClick={() => handleButtonClick(button)}
            disabled={isButtonDisabled(button)}
            aria-label={button.label}
          >
            <span className="button-icon">{button.icon}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        {toolbarButtons.filter(btn => btn.id.startsWith('heading') || btn.id === 'paragraph').map((button) => (
          <button
            key={button.id}
            type="button"
            className={`toolbar-button ${isButtonActive(button) ? 'active' : ''} ${isButtonDisabled(button) ? 'disabled' : ''}`}
            title={button.title}
            onClick={() => handleButtonClick(button)}
            disabled={isButtonDisabled(button)}
            aria-label={button.label}
          >
            <span className="button-icon">{button.icon}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        {toolbarButtons.filter(btn => ['bulletList', 'orderedList'].includes(btn.id)).map((button) => (
          <button
            key={button.id}
            type="button"
            className={`toolbar-button ${isButtonActive(button) ? 'active' : ''} ${isButtonDisabled(button) ? 'disabled' : ''}`}
            title={button.title}
            onClick={() => handleButtonClick(button)}
            disabled={isButtonDisabled(button)}
            aria-label={button.label}
          >
            <span className="button-icon">{button.icon}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        {toolbarButtons.filter(btn => ['codeBlock', 'blockquote', 'link'].includes(btn.id)).map((button) => (
          <button
            key={button.id}
            type="button"
            className={`toolbar-button ${isButtonActive(button) ? 'active' : ''} ${isButtonDisabled(button) ? 'disabled' : ''}`}
            title={button.title}
            onClick={() => handleButtonClick(button)}
            disabled={isButtonDisabled(button)}
            aria-label={button.label}
          >
            <span className="button-icon">{button.icon}</span>
          </button>
        ))}
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        {toolbarButtons.filter(btn => ['undo', 'redo'].includes(btn.id)).map((button) => (
          <button
            key={button.id}
            type="button"
            className={`toolbar-button ${isButtonActive(button) ? 'active' : ''} ${isButtonDisabled(button) ? 'disabled' : ''}`}
            title={button.title}
            onClick={() => handleButtonClick(button)}
            disabled={isButtonDisabled(button)}
            aria-label={button.label}
          >
            <span className="button-icon">{button.icon}</span>
          </button>
        ))}
      </div>
      </div>
      
      <LinkDialog
        isOpen={linkDialogOpen}
        onConfirm={handleLinkConfirm}
        onCancel={handleLinkCancel}
      />
    </>
  );
};

export default Toolbar;