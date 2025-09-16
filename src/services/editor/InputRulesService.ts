import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from 'prosemirror-inputrules';
import { NodeType, MarkType, Schema, Slice, Fragment } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { wrapInList, splitListItem } from 'prosemirror-schema-list';

/**
 * Creates input rules for markdown-style formatting
 */
export class InputRulesService {
  private schema: Schema;

  constructor(schema: Schema) {
    this.schema = schema;
  }

  /**
   * Creates all input rules for the editor
   */
  createInputRules() {
    const rules: InputRule[] = [
      // Heading rules (# ## ###)
      ...this.createHeadingRules(),
      
      // List rules (- * 1. 2.)
      ...this.createListRules(),
      
      // Code block rules (```)
      ...this.createCodeBlockRules(),
      
      // Blockquote rules (>)
      ...this.createBlockquoteRules(),
      
      // Mark rules (bold, italic, code)
      ...this.createMarkRules(),
      
      // Link rules ([text](url))
      ...this.createLinkRules(),
      
      // Horizontal rule (---)
      ...this.createHorizontalRuleRules(),
      
      // Arrow rules (->)
      ...this.createArrowRules(),
      
      // Task list rules ([])
      ...this.createTaskListRules(),
    ];

    return inputRules({ rules });
  }

  /**
   * Create heading input rules for # ## ### etc.
   */
  private createHeadingRules(): InputRule[] {
    const headingRule = textblockTypeInputRule(
      /^(#{1,6})\s$/,
      this.schema.nodes.heading,
      (match) => ({ level: match[1].length })
    );

    return [headingRule];
  }

  /**
   * Create list input rules for - * 1. 2. etc.
   */
  private createListRules(): InputRule[] {
    const rules: InputRule[] = [];

    // Bullet list rules for - and *
    if (this.schema.nodes.bullet_list && this.schema.nodes.list_item) {
      rules.push(
        wrappingInputRule(
          /^\s*([-+*])\s$/,
          this.schema.nodes.bullet_list
        )
      );
    }

    // Ordered list rule for 1. 2. etc.
    if (this.schema.nodes.ordered_list && this.schema.nodes.list_item) {
      rules.push(
        wrappingInputRule(
          /^\s*(\d+)\.\s$/,
          this.schema.nodes.ordered_list,
          (match) => ({ order: +match[1] })
        )
      );
    }

    return rules;
  }

  /**
   * Create code block input rules for ```
   */
  private createCodeBlockRules(): InputRule[] {
    if (!this.schema.nodes.code_block) return [];

    const codeBlockRule = textblockTypeInputRule(
      /^```(\S*)\s$/,
      this.schema.nodes.code_block,
      (match) => ({ language: match[1] || null })
    );

    return [codeBlockRule];
  }

  /**
   * Create blockquote input rules for >
   */
  private createBlockquoteRules(): InputRule[] {
    if (!this.schema.nodes.blockquote) return [];

    const blockquoteRule = wrappingInputRule(/^\s*>\s$/, this.schema.nodes.blockquote);
    return [blockquoteRule];
  }

  /**
   * Create mark input rules for bold, italic, code
   */
  private createMarkRules(): InputRule[] {
    const rules: InputRule[] = [];

    // Bold rules (**text** and __text__)
    if (this.schema.marks.strong) {
      rules.push(
        this.createMarkInputRule(/\*\*([^*]+)\*\*$/, this.schema.marks.strong),
        this.createMarkInputRule(/__([^_]+)__$/, this.schema.marks.strong)
      );
    }

    // Italic rules (*text* and _text_)
    if (this.schema.marks.em) {
      rules.push(
        this.createMarkInputRule(/(?<!\*)\*([^*]+)\*(?!\*)$/, this.schema.marks.em),
        this.createMarkInputRule(/(?<!_)_([^_]+)_(?!_)$/, this.schema.marks.em)
      );
    }

    // Code rules (`text`)
    if (this.schema.marks.code) {
      rules.push(
        this.createMarkInputRule(/`([^`]+)`$/, this.schema.marks.code)
      );
    }

    return rules;
  }

  /**
   * Helper to create mark input rules
   */
  private createMarkInputRule(regexp: RegExp, markType: MarkType): InputRule {
    return new InputRule(
      regexp,
      (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
        const { tr } = state;
        const captureGroup = match[1];
        const fullMatch = match[0];
        const markStart = start;
        const markEnd = end;

        // Remove the markdown syntax
        tr.delete(markStart, markEnd);
        
        // Insert the text with the mark
        const mark = markType.create();
        tr.insertText(captureGroup, markStart).addMark(markStart, markStart + captureGroup.length, mark);

        return tr;
      }
    );
  }

  /**
   * Create link input rules for [text](url) and auto-links
   */
  private createLinkRules(): InputRule[] {
    const rules: InputRule[] = [];

    if (!this.schema.marks.link) return rules;

    // Markdown link rule [text](url)
    const markdownLinkRule = new InputRule(
      /\[([^\]]+)\]\(([^)]+)\)$/,
      (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
        const { tr } = state;
        const [fullMatch, text, href] = match;
        
        // Remove the markdown syntax
        tr.delete(start, end);
        
        // Insert the linked text
        const linkMark = this.schema.marks.link.create({ href });
        tr.insertText(text, start).addMark(start, start + text.length, linkMark);

        return tr;
      }
    );

    // Auto-link rule for URLs
    const autoLinkRule = new InputRule(
      /https?:\/\/[^\s]+$/,
      (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
        const { tr } = state;
        const url = match[0];
        
        // Add link mark to the URL
        const linkMark = this.schema.marks.link.create({ href: url });
        tr.addMark(start, end, linkMark);

        return tr;
      }
    );

    rules.push(markdownLinkRule, autoLinkRule);
    return rules;
  }

  /**
   * Create horizontal rule input rules for ---
   */
  private createHorizontalRuleRules(): InputRule[] {
    if (!this.schema.nodes.horizontal_rule) return [];

    const hrRule = new InputRule(
      /^(---|—-)$/,
      (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
        const horizontalRuleNode = this.schema.nodes.horizontal_rule.create();
        const paragraphNode = this.schema.nodes.paragraph.create();
        const fragment = Fragment.from([horizontalRuleNode, paragraphNode]);
        const slice = new Slice(fragment, 0, 0);
        
        return state.tr.replaceRange(start, end, slice);
      }
    );

    return [hrRule];
  }

  /**
   * Create task list input rules for []
   */
  private createTaskListRules(): InputRule[] {
    if (!this.schema.nodes.task_list || !this.schema.nodes.task_list_item) return [];

    // Use wrappingInputRule similar to bullet lists for consistent behavior
    const taskListRule = wrappingInputRule(
      /^\[\]\s$/,
      this.schema.nodes.task_list,
      () => ({ checked: false })
    );

    return [taskListRule];
  }

  /**
   * Create arrow input rules for -> and <-
   */
  private createArrowRules(): InputRule[] {
    const rightArrowRule = new InputRule(
      /->$/,
      (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
        const { tr } = state;
        
        // Replace '->' with '→' (rightwards arrow)
        tr.replaceWith(start, end, state.schema.text('→'));
        
        return tr;
      }
    );

    const leftArrowRule = new InputRule(
      /<-$/,
      (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
        const { tr } = state;
        
        // Replace '<-' with '←' (leftwards arrow)
        tr.replaceWith(start, end, state.schema.text('←'));
        
        return tr;
      }
    );

    const bananaRule = new InputRule(
      /banana$/,
      (state: EditorState, match: RegExpMatchArray, start: number, end: number) => {
        const { tr } = state;
        
        // Replace 'banana' with '🍌' (banana emoji)
        tr.replaceWith(start, end, state.schema.text('🍌'));
        
        return tr;
      }
    );

    return [rightArrowRule, leftArrowRule, bananaRule];
  }
}

export default InputRulesService;