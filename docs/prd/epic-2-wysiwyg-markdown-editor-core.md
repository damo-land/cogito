# Epic 2: WYSIWYG Markdown Editor Core
Implement the advanced editing experience that makes this extension competitive with tools like Notion, including seamless WYSIWYG editing, comprehensive markdown support, and intuitive formatting controls.

## Story 2.1: Advanced WYSIWYG Editor Implementation
As a user,
I want to edit markdown with rich text formatting that updates in real-time,
so that I can focus on content without thinking about syntax.

### Acceptance Criteria
1. Typing markdown syntax immediately creates formatted text without requiring markdown knowledge
2. Markdown syntax (*bold*, # heading) is instantly converted to rich formatting as user types
3. Editor displays only formatted content - no raw markdown view is provided to users
4. Editor handles supported markdown elements (headers, bold, italic, lists, links, simple code blocks)
5. Performance remains smooth during instant conversion and rendering

## Story 2.2: Keyboard Shortcuts and Hotkeys
As a power user,
I want comprehensive keyboard shortcuts for all formatting operations,
so that I can write efficiently without reaching for the mouse.

### Acceptance Criteria
1. Standard shortcuts work (Ctrl+B bold, Ctrl+I italic, Ctrl+Z undo)
2. Markdown-specific shortcuts are available (Ctrl+Shift+1 for H1, etc.)
3. Custom shortcuts can be configured through settings
4. Shortcuts are displayed in context menus and help documentation
5. Shortcuts work consistently across all editor modes and states

## Story 2.3: Slash Commands and Quick Formatting
As a user,
I want to use slash commands to quickly insert formatted blocks,
so that I can add headers, lists, and code blocks without memorizing syntax.

### Acceptance Criteria
1. Typing "/" brings up a command palette with available options
2. Commands include headers (h1-h6), lists (ordered/unordered), code blocks, quotes
3. Command palette filters as user types additional characters
4. Commands can be selected with keyboard navigation or mouse clicks
5. Commands insert properly formatted blocks at the cursor position

## Story 2.4: Advanced Markdown Features Support
As a user,
I want support for advanced markdown features like tables, links, and images,
so that I can create comprehensive documents.

### Acceptance Criteria
1. Simple tables can be created through UI interface (complex markdown tables are not auto-converted)
2. Links are automatically detected and can be easily inserted/edited
3. Images can be referenced (though local display may be limited in extension context)
4. Inline code and simple code blocks render with basic highlighting
5. Complex elements like nested blockquotes, advanced tables, and footnotes are intentionally excluded