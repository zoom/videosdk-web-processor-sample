import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileText, AlertCircle, Loader2, List, Search, ZoomIn, ZoomOut, X } from 'lucide-react';

interface MarkdownRendererProps {
  content: string | null;
  loading: boolean;
  error: string | null;
  fallbackContent?: React.ReactNode;
  enableToc?: boolean;
  enableSearch?: boolean;
  enableImageZoom?: boolean;
  enableFootnotes?: boolean;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface Footnote {
  id: string;
  content: string;
}

// Advanced markdown parser with full feature support
const parseMarkdown = (markdown: string, options: {
  enableToc?: boolean;
  enableFootnotes?: boolean;
  enableImageZoom?: boolean;
} = {}) => {
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  const tocItems: TocItem[] = [];
  const footnotes: Footnote[] = [];
  let currentCodeBlock = '';
  let isInCodeBlock = false;
  let codeLanguage = '';
  let currentTable: string[][] = [];
  let isInTable = false;
  let tableHeaders: string[] = [];
  let currentList: string[] = [];
  let isInList = false;
  let listType: 'ul' | 'ol' = 'ul';
  let currentQuote: string[] = [];
  let isInQuote = false;

  const flushTable = (index: number) => {
    if (currentTable.length > 0) {
      elements.push(
        <div key={`table-${index}`} className="my-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                {tableHeaders.map((header, idx) => (
                  <th key={idx} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0">
                    {processInlineFormatting(header.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentTable.map((row, rowIdx) => (
                <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 last:border-r-0">
                      {processInlineFormatting(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      currentTable = [];
      tableHeaders = [];
    }
  };

  const flushList = (index: number) => {
    if (currentList.length > 0) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <ListTag key={`list-${index}`} className={`my-4 ${listType === 'ol' ? 'list-decimal' : 'list-disc'} list-inside space-y-2`}>
          {currentList.map((item, idx) => (
            <li key={idx} className="text-gray-600 leading-relaxed pl-2">
              {processInlineFormatting(item)}
            </li>
          ))}
        </ListTag>
      );
      currentList = [];
    }
  };

  const flushQuote = (index: number) => {
    if (currentQuote.length > 0) {
      elements.push(
        <blockquote key={`quote-${index}`} className="my-6 pl-4 border-l-4 border-blue-500 bg-blue-50 py-2 pr-4">
          {currentQuote.map((line, idx) => (
            <p key={idx} className="text-gray-700 italic leading-relaxed mb-2 last:mb-0">
              {processInlineFormatting(line)}
            </p>
          ))}
        </blockquote>
      );
      currentQuote = [];
    }
  };

  const processInlineFormatting = (text: string): React.ReactNode => {
    if (!text) return text;
    
    // Handle footnotes: [^1]
    if (options.enableFootnotes) {
      text = text.replace(/\[\^([^\]]+)\]/g, (match, footnoteId) => {
        return `<sup><a href="#footnote-${footnoteId}" class="text-blue-600 hover:text-blue-800 text-xs">[${footnoteId}]</a></sup>`;
      });
    }
    
    // Handle links: [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>');
    
    // Handle images: ![alt](src)
    if (options.enableImageZoom) {
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto my-4 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow" onclick="window.openImageModal && window.openImageModal(\'$2\', \'$1\')" />');
    } else {
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full h-auto my-4 rounded-lg shadow-md" />');
    }
    
    // Handle bold: **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');
    
    // Handle italic: *text*
    text = text.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
    
    // Handle strikethrough: ~~text~~
    text = text.replace(/~~([^~]+)~~/g, '<del class="line-through">$1</del>');
    
    // Handle inline code: `code`
    text = text.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">$1</code>');
    
    // Handle math: $equation$ (inline)
    text = text.replace(/\$([^$]+)\$/g, '<span class="bg-yellow-50 px-2 py-1 rounded text-sm font-mono border">$1</span>');
    
    // Handle keyboard shortcuts: [[key]]
    text = text.replace(/\[\[([^\]]+)\]\]/g, '<kbd class="px-2 py-1 bg-gray-200 border border-gray-300 rounded text-xs font-mono shadow-sm">$1</kbd>');
    
    return <span dangerouslySetInnerHTML={{ __html: text }} />;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Handle code blocks
    if (line.startsWith('```')) {
      // Flush any pending elements
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;

      if (!isInCodeBlock) {
        isInCodeBlock = true;
        codeLanguage = line.substring(3).trim() || 'text';
        currentCodeBlock = '';
      } else {
        isInCodeBlock = false;
        elements.push(
          <div key={i} className="my-4">
            <SyntaxHighlighter 
              language={codeLanguage} 
              style={dracula}
              className="rounded-lg"
            >
              {currentCodeBlock}
            </SyntaxHighlighter>
          </div>
        );
        currentCodeBlock = '';
      }
      continue;
    }

    if (isInCodeBlock) {
      currentCodeBlock += line + '\n';
      continue;
    }

    // Handle horizontal rule
    if (trimmedLine === '---' || trimmedLine === '***' || trimmedLine === '___') {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;
      elements.push(<hr key={i} className="my-8 border-gray-300" />);
      continue;
    }

    // Handle tables
    if (trimmedLine.includes('|') && trimmedLine.split('|').length > 2) {
      if (!isInTable) {
        // Flush other elements
        flushList(i);
        flushQuote(i);
        isInList = false;
        isInQuote = false;
        
        // Start table
        isInTable = true;
        tableHeaders = trimmedLine.split('|').map(h => h.trim()).filter(h => h !== '');
        continue;
      } else {
        // Check if this is a separator line (|---|---|)
        if (trimmedLine.includes('---')) {
          continue;
        }
        // Add table row
        const cells = trimmedLine.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        currentTable.push(cells);
        continue;
      }
    } else if (isInTable) {
      // End of table
      flushTable(i);
      isInTable = false;
    }

    // Handle lists
    const unorderedMatch = trimmedLine.match(/^[-*+]\s+(.+)$/);
    const orderedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    const taskMatch = trimmedLine.match(/^[-*+]\s+\[([ x])\]\s+(.+)$/);

    if (unorderedMatch || orderedMatch || taskMatch) {
      if (!isInList || (isInList && ((unorderedMatch || taskMatch) && listType === 'ol') || (orderedMatch && listType === 'ul'))) {
        // Flush other elements
        flushTable(i);
        flushQuote(i);
        isInTable = false;
        isInQuote = false;
        
        if (isInList) flushList(i);
        
        // Start new list
        isInList = true;
        listType = orderedMatch ? 'ol' : 'ul';
        currentList = [];
      }

      if (taskMatch) {
        const [, checked, text] = taskMatch;
        currentList.push(`<span class="flex items-center"><input type="checkbox" ${checked === 'x' ? 'checked' : ''} disabled class="mr-2" />${text}</span>`);
      } else {
        const text = unorderedMatch ? unorderedMatch[1] : orderedMatch![1];
        currentList.push(text);
      }
      continue;
    } else if (isInList && trimmedLine === '') {
      // Empty line might end list, but let's continue for now
      continue;
    } else if (isInList) {
      // End of list
      flushList(i);
      isInList = false;
    }

    // Handle blockquotes
    if (trimmedLine.startsWith('> ')) {
      if (!isInQuote) {
        // Flush other elements
        flushTable(i);
        flushList(i);
        isInTable = false;
        isInList = false;
        isInQuote = true;
        currentQuote = [];
      }
      currentQuote.push(trimmedLine.substring(2));
      continue;
    } else if (isInQuote && trimmedLine === '') {
      // Empty line in quote
      currentQuote.push('');
      continue;
    } else if (isInQuote) {
      // End of quote
      flushQuote(i);
      isInQuote = false;
    }

    // Handle footnote definitions: [^1]: content
    if (options.enableFootnotes && trimmedLine.match(/^\[\^([^\]]+)\]:\s*(.+)$/)) {
      const match = trimmedLine.match(/^\[\^([^\]]+)\]:\s*(.+)$/);
      if (match) {
        footnotes.push({
          id: match[1],
          content: match[2]
        });
      }
      continue;
    }

    // Handle headings
    const createHeading = (level: number, text: string, index: number) => {
      const headingText = text.trim();
      const headingId = options.enableToc ? `heading-${headingText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined;
      
      if (options.enableToc && headingText) {
        tocItems.push({
          id: headingId!,
          text: headingText,
          level: level
        });
      }

      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      const className = {
        1: "text-3xl font-bold text-gray-800 mb-6 mt-8 first:mt-0",
        2: "text-2xl font-semibold text-gray-800 mb-4 mt-6",
        3: "text-xl font-semibold text-gray-700 mb-3 mt-4",
        4: "text-lg font-medium text-gray-700 mb-2 mt-3",
        5: "text-base font-medium text-gray-700 mb-2 mt-3",
        6: "text-sm font-medium text-gray-700 mb-2 mt-3"
      }[level];

      return React.createElement(HeadingTag, {
        key: index,
        id: headingId,
        className: className
      }, processInlineFormatting(headingText));
    };

    if (trimmedLine.startsWith('# ')) {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;
      elements.push(createHeading(1, trimmedLine.substring(2), i));
    } else if (trimmedLine.startsWith('## ')) {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;
      elements.push(createHeading(2, trimmedLine.substring(3), i));
    } else if (trimmedLine.startsWith('### ')) {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;
      elements.push(createHeading(3, trimmedLine.substring(4), i));
    } else if (trimmedLine.startsWith('#### ')) {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;
      elements.push(createHeading(4, trimmedLine.substring(5), i));
    } else if (trimmedLine.startsWith('##### ')) {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;
      elements.push(createHeading(5, trimmedLine.substring(6), i));
    } else if (trimmedLine.startsWith('###### ')) {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;
      elements.push(createHeading(6, trimmedLine.substring(7), i));
    }
    // Handle empty lines
    else if (trimmedLine === '') {
      // Add some spacing for empty lines, but not if we're in special blocks
      if (!isInTable && !isInList && !isInQuote) {
        elements.push(<div key={i} className="my-2" />);
      }
    }
    // Handle regular paragraphs
    else if (trimmedLine !== '') {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;
      elements.push(
        <p key={i} className="mb-4 text-gray-600 leading-relaxed">
          {processInlineFormatting(trimmedLine)}
        </p>
      );
    }
  }

  // Flush any remaining elements
  flushTable(lines.length);
  flushList(lines.length);
  flushQuote(lines.length);

  // Add footnotes section
  if (options.enableFootnotes && footnotes.length > 0) {
    elements.push(
      <div key="footnotes" className="mt-12 pt-8 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Footnotes</h3>
        {footnotes.map((footnote) => (
          <div key={footnote.id} id={`footnote-${footnote.id}`} className="mb-2 text-sm text-gray-600">
            <span className="font-medium">[{footnote.id}]</span>{' '}
            <span>{processInlineFormatting(footnote.content)}</span>
          </div>
        ))}
      </div>
    );
  }

  return { elements, tocItems, footnotes };
};

export default function MarkdownRenderer({ 
  content, 
  loading, 
  error, 
  fallbackContent,
  enableToc = true,
  enableSearch = true,
  enableImageZoom = true,
  enableFootnotes = true
}: MarkdownRendererProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{src: string; alt: string} | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Setup image zoom modal
  useEffect(() => {
    if (enableImageZoom && typeof window !== 'undefined') {
      (window as any).openImageModal = (src: string, alt: string) => {
        setZoomedImage({ src, alt });
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).openImageModal;
      }
    };
  }, [enableImageZoom]);

  // Highlight search results
  useEffect(() => {
    if (!searchQuery || !contentRef.current) return;

    const content = contentRef.current;
    const walker = document.createTreeWalker(
      content,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    // Remove existing highlights
    const existingHighlights = content.querySelectorAll('.search-highlight');
    existingHighlights.forEach(highlight => {
      const parent = highlight.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(highlight.textContent || ''), highlight);
        parent.normalize();
      }
    });

    if (searchQuery.length >= 2) {
      textNodes.forEach(textNode => {
        const text = textNode.textContent || '';
        const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (regex.test(text)) {
          const highlightedText = text.replace(regex, '<mark class="search-highlight bg-yellow-200 px-1 rounded">$&</mark>');
          const wrapper = document.createElement('span');
          wrapper.innerHTML = highlightedText;
          textNode.parentNode?.replaceChild(wrapper, textNode);
        }
      });
    }
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-gray-600">Loading documentation...</span>
        </div>
      </div>
    );
  }

  if (error && !content) {
    // If there's an error and no content, show fallback
    if (fallbackContent) {
      return (
        <div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Custom documentation not found. Showing default content.
              </span>
            </div>
          </div>
          {fallbackContent}
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            Documentation Not Available
          </h3>
          <p className="text-gray-500">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-700 mb-2">
            No Documentation Available
          </h3>
        </div>
      </div>
    );
  }

  const parseResult = parseMarkdown(content, {
    enableToc,
    enableFootnotes,
    enableImageZoom
  });

  const { elements, tocItems } = parseResult;

  return (
    <div className="relative">
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-4">
          {enableToc && tocItems.length > 0 && (
            <button
              onClick={() => setShowToc(!showToc)}
              className="flex items-center space-x-2 px-3 py-2 bg-white rounded-md shadow-sm hover:shadow-md transition-shadow"
            >
              <List className="w-4 h-4" />
              <span className="text-sm font-medium">Table of Contents</span>
            </button>
          )}
        </div>
        
        {enableSearch && (
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Table of Contents Sidebar */}
        {enableToc && showToc && tocItems.length > 0 && (
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-4 bg-white rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Contents</h3>
              <nav className="space-y-1">
                {tocItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`block text-sm text-gray-600 hover:text-blue-600 transition-colors ${
                      item.level === 1 ? 'font-medium' : 
                      item.level === 2 ? 'pl-3' :
                      item.level === 3 ? 'pl-6' :
                      'pl-9'
                    }`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(item.id)?.scrollIntoView({ 
                        behavior: 'smooth' 
                      });
                    }}
                  >
                    {item.text}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 prose prose-gray max-w-none">
          <div className="bg-white rounded-2xl shadow-lg p-8" ref={contentRef}>
            {elements}
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {enableImageZoom && zoomedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setZoomedImage(null)}>
          <div className="relative max-w-4xl max-h-4xl p-4">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedImage.src}
              alt={zoomedImage.alt}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            {zoomedImage.alt && (
              <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded text-sm text-center">
                {zoomedImage.alt}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 