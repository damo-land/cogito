import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import { Schema, Node as ProseMirrorNode, DOMParser } from 'prosemirror-model';
import DOMPurify from 'dompurify';

export class SimpleMarkdownService {
  private processor = unified()
    .use(remarkParse)
    .use(remarkGfm);

  private htmlProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkHtml);

  /**
   * Convert markdown to HTML for display
   */
  async markdownToHtml(markdown: string): Promise<string> {
    try {
      const result = await this.htmlProcessor.process(markdown);
      return String(result);
    } catch (error) {
      console.error('Failed to convert markdown to HTML:', error);
      return markdown;
    }
  }

  /**
   * Parse markdown to ProseMirror document
   */
  parseMarkdown(markdown: string, schema: Schema): ProseMirrorNode {
    try {
      console.log('🔍 parseMarkdown INPUT:', {
        length: markdown.length,
        preview: markdown.substring(0, 100) + (markdown.length > 100 ? '...' : ''),
        lines: markdown.split('\n').length,
        firstLine: markdown.split('\n')[0] || '',
        lastLine: markdown.split('\n')[markdown.split('\n').length - 1] || ''
      });

      if (!markdown || typeof markdown !== 'string') {
        return schema.nodes.doc.createAndFill()!;
      }


      // Line-by-line approach to preserve exact structure
      const tempDiv = document.createElement('div');
      const lines = markdown.split('\n');
      let html = '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        if (trimmedLine === '') {
          // Preserve empty lines as empty paragraphs
          html += '<p></p>';
        } else if (/^#{1,6}\s+/.test(trimmedLine)) {
          // Headers
          const match = trimmedLine.match(/^#{1,6}/);
          const level = match ? match[0].length : 1;
          const text = trimmedLine.replace(/^#{1,6}\s+/, '');
          html += `<h${level}>${this.processInlineMarkdown(text)}</h${level}>`;
        } else if (/^```/.test(trimmedLine)) {
          // Code blocks - find the end
          const lang = trimmedLine.replace(/^```/, '');
          const codeLines = [];
          i++; // Skip the opening ```
          while (i < lines.length && !lines[i].trim().startsWith('```')) {
            codeLines.push(lines[i]);
            i++;
          }
          const langAttr = lang ? ` data-language="${lang}"` : '';
          html += `<pre${langAttr}><code>${codeLines.join('\n')}</code></pre>`;
        } else if (/^-\s*\[\s*\]\s+/.test(trimmedLine)) {
          // Unchecked task item
          const text = trimmedLine.replace(/^-\s*\[\s*\]\s+/, '');
          html += `<ul data-type="taskList"><li data-type="taskItem" data-checked="false" class="task-item-unchecked">${this.processInlineMarkdown(text)}</li></ul>`;
        } else if (/^-\s*\[x\]\s+/i.test(trimmedLine)) {
          // Checked task item
          const text = trimmedLine.replace(/^-\s*\[x\]\s+/i, '');
          html += `<ul data-type="taskList"><li data-type="taskItem" data-checked="true" class="task-item-checked">${this.processInlineMarkdown(text)}</li></ul>`;
        } else if (/^\s*\d+\.\s+/.test(trimmedLine)) {
          // Ordered list
          const text = trimmedLine.replace(/^\s*\d+\.\s+/, '');
          html += `<ol><li>${this.processInlineMarkdown(text)}</li></ol>`;
        } else if (/^\s*[-*+]\s+/.test(trimmedLine)) {
          // Unordered list
          const text = trimmedLine.replace(/^\s*[-*+]\s+/, '');
          html += `<ul><li>${this.processInlineMarkdown(text)}</li></ul>`;
        } else if (/^>\s+/.test(trimmedLine)) {
          // Blockquote
          const text = trimmedLine.replace(/^>\s+/, '');
          html += `<blockquote>${this.processInlineMarkdown(text)}</blockquote>`;
        } else if (/^---+$/.test(trimmedLine)) {
          // Horizontal rule
          html += '<hr>';
        } else {
          // Regular paragraph - preserve all whitespace
          html += `<p>${this.processInlineMarkdown(line)}</p>`;
        }
      }
      
      // Sanitize HTML to prevent XSS attacks
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr'],
        ALLOWED_ATTR: ['href', 'data-language', 'data-type', 'data-checked', 'class'],
        ALLOW_DATA_ATTR: true
      });
      
      tempDiv.innerHTML = sanitizedHtml;
      const parsedDoc = DOMParser.fromSchema(schema).parse(tempDiv);
      
      console.log('📤 parseMarkdown OUTPUT:', {
        docSize: parsedDoc.content.size,
        nodeCount: parsedDoc.nodeSize,
        childCount: parsedDoc.childCount,
        htmlUsed: sanitizedHtml.substring(0, 100) + (sanitizedHtml.length > 100 ? '...' : '')
      });
      
      return parsedDoc;
    } catch (error) {
      console.error('Failed to parse markdown:', error);
      return schema.nodes.doc.createAndFill()!;
    }
  }

  /**
   * Serialize ProseMirror document to markdown
   */
  serializeToMarkdown(doc: ProseMirrorNode): string {
    console.log('📝 serializeToMarkdown INPUT:', {
      docSize: doc.content.size,
      nodeCount: doc.nodeSize,
      childCount: doc.childCount
    });

    let markdown = '';
    let isFirst = true;
    

    doc.forEach((node) => {
      let nodeMarkdown = '';
      
      switch (node.type.name) {
        case 'paragraph':
          const paragraphText = this.nodeToText(node);
          // Always include paragraphs, even empty ones to preserve line breaks
          nodeMarkdown = paragraphText;
          break;
        case 'heading':
          const level = '#'.repeat(node.attrs.level);
          nodeMarkdown = `${level} ${this.nodeToText(node)}`;
          break;
        case 'blockquote':
          nodeMarkdown = `> ${this.nodeToText(node)}`;
          break;
        case 'code_block':
          const language = node.attrs.language;
          const langPrefix = language ? language : '';
          nodeMarkdown = `\`\`\`${langPrefix}\n${node.textContent}\n\`\`\``;
          break;
        case 'bullet_list':
          nodeMarkdown = this.serializeList(node, '-');
          break;
        case 'ordered_list':
          nodeMarkdown = this.serializeList(node, '1.', node.attrs.order || 1);
          break;
        case 'task_list':
          nodeMarkdown = this.serializeTaskList(node);
          break;
        case 'task_list_item':
          // Task list items are handled within their parent task lists
          break;
        case 'list_item':
          // List items are handled within their parent lists
          break;
        case 'horizontal_rule':
          nodeMarkdown = '---';
          break;
        default:
          const text = this.nodeToText(node);
          if (text.trim()) {
            nodeMarkdown = text;
          }
      }
      
      // Always add nodes to maintain structure, but handle empty paragraphs specially
      if (!isFirst) {
        markdown += '\n';
      }
      
      if (nodeMarkdown || node.type.name === 'paragraph') {
        markdown += nodeMarkdown;
      }
      
      isFirst = false;
    });

    console.log('📦 serializeToMarkdown OUTPUT:', {
      length: markdown.length,
      preview: markdown.substring(0, 100) + (markdown.length > 100 ? '...' : ''),
      lines: markdown.split('\n').length,
      firstLine: markdown.split('\n')[0] || '',
      lastLine: markdown.split('\n')[markdown.split('\n').length - 1] || ''
    });

    return markdown;
  }

  /**
   * Serialize list nodes to markdown
   */
  private serializeList(listNode: ProseMirrorNode, marker: string, startNum?: number): string {
    let listMarkdown = '';
    let currentNum = startNum || 1;

    listNode.forEach((listItem) => {
      if (listItem.type.name === 'list_item') {
        let itemText = '';
        
        listItem.forEach((itemChild) => {
          if (itemChild.type.name === 'paragraph') {
            itemText += this.nodeToText(itemChild);
          } else if (itemChild.type.name === 'bullet_list' || itemChild.type.name === 'ordered_list') {
            // Handle nested lists with proper indentation
            const nestedMarker = itemChild.type.name === 'bullet_list' ? '-' : '1.';
            const nestedList = this.serializeList(itemChild, nestedMarker);
            itemText += '\n' + nestedList.split('\n').map(line => '  ' + line).join('\n');
          }
        });

        if (itemText.trim()) {
          const currentMarker = marker === '1.' ? `${currentNum}.` : marker;
          listMarkdown += `${currentMarker} ${itemText.trim()}\n`;
          if (marker === '1.') currentNum++;
        }
      }
    });

    return listMarkdown.trimEnd();
  }

  /**
   * Serialize task list nodes to markdown
   */
  private serializeTaskList(taskListNode: ProseMirrorNode): string {
    let taskMarkdown = '';

    taskListNode.forEach((taskItem) => {
      if (taskItem.type.name === 'task_list_item') {
        const isChecked = taskItem.attrs.checked;
        const checkboxSymbol = isChecked ? '[x]' : '[ ]';
        
        let itemText = '';
        taskItem.forEach((itemChild) => {
          if (itemChild.type.name === 'paragraph') {
            itemText += this.nodeToText(itemChild);
          }
        });

        if (itemText.trim()) {
          taskMarkdown += `- ${checkboxSymbol} ${itemText.trim()}\n`;
        }
      }
    });

    return taskMarkdown.trimEnd();
  }

  private nodeToText(node: ProseMirrorNode): string {
    let text = '';
    
    node.forEach((child) => {
      if (child.type.name === 'text') {
        let childText = child.text || '';
        
        // Apply marks in the correct order (links first, then formatting)
        const linkMark = child.marks.find(mark => mark.type.name === 'link');
        const otherMarks = child.marks.filter(mark => mark.type.name !== 'link');
        
        // Apply non-link formatting marks first
        otherMarks.forEach((mark) => {
          switch (mark.type.name) {
            case 'strong':
              childText = `**${childText}**`;
              break;
            case 'em':
              childText = `*${childText}*`;
              break;
            case 'code':
              childText = `\`${childText}\``;
              break;
          }
        });
        
        // Apply link mark last (outermost)
        if (linkMark) {
          const href = linkMark.attrs.href;
          childText = `[${childText}](${href})`;
        }
        
        // Note: Input rule conversions remain as symbols in storage
        
        text += childText;
      } else {
        text += this.nodeToText(child);
      }
    });

    return text;
  }

  /**
   * Process inline markdown (bold, italic, code, links) while preserving whitespace
   */
  private processInlineMarkdown(text: string): string {
    return text
      // Links [text](url)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      
      // Bold and italic (non-greedy matching)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>')
      
      // Inline code
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  /**
   * Check if text contains markdown syntax
   */
  hasMarkdownSyntax(text: string): boolean {
    if (!text || typeof text !== 'string') return false;
    
    const markdownPatterns = [
      /^#{1,6}\s+/m,        // Headers
      /\*\*.*?\*\*/,        // Bold
      /(?<!\*)\*[^*]+\*(?!\*)/, // Italic (avoid matching ** as *)
      /`.*?`/,              // Code
      /^\> /m,              // Blockquotes
      /^\d+\.\s+/m,         // Ordered lists
      /^[-*+]\s+/m,         // Unordered lists
    ];

    return markdownPatterns.some(pattern => pattern.test(text));
  }
}

// Singleton instance
export const simpleMarkdownService = new SimpleMarkdownService();
export default simpleMarkdownService;