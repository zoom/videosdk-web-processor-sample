import React, { useState, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { 
  dracula, 
  okaidia,
  synthwave84,
  prism,
  tomorrow,
  twilight
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileText, AlertCircle, Loader2, List, Search, ZoomIn, ZoomOut, X, Palette, ChevronDown } from 'lucide-react';
import { markdownThemes, getThemeById, getThemesByCategory, MarkdownTheme } from '../config/markdown-themes';

interface MarkdownRendererProps {
  content: string | null;
  loading: boolean;
  error: string | null;
  fallbackContent?: React.ReactNode;
  enableToc?: boolean;
  enableSearch?: boolean;
  enableImageZoom?: boolean;
  enableFootnotes?: boolean;
  enableThemes?: boolean;
  defaultTheme?: string;
  basePath?: string; // Base path for resolving relative image paths
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

// Function to get the appropriate code theme based on markdown theme
const getCodeTheme = (theme: MarkdownTheme) => {
  // Map theme names to actual Prism theme objects
  const codeThemes: Record<string, any> = {
    'dracula': dracula,
    'okaidia': okaidia,
    'synthwave84': synthwave84,
    'prism': prism,
    'tomorrow': tomorrow,
    'twilight': twilight
  };

  // Return the specified theme or fallback based on category
  if (codeThemes[theme.codeTheme]) {
    return codeThemes[theme.codeTheme];
  }

  // Fallback based on category
  switch (theme.category) {
    case 'light':
      return prism;
    case 'dark':
      return dracula;
    case 'colorful':
      return synthwave84;
    default:
      return prism;
  }
};

// Advanced markdown parser with theme support
const parseMarkdown = (markdown: string, theme: MarkdownTheme, options: {
  enableToc?: boolean;
  enableFootnotes?: boolean;
  enableImageZoom?: boolean;
  basePath?: string;
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

  // Get the appropriate code theme for this markdown theme
  const codeTheme = getCodeTheme(theme);

  const flushTable = (index: number) => {
    if (currentTable.length > 0) {
      elements.push(
        <div key={`table-${index}`} className="my-6 overflow-x-auto">
          <table className={theme.styles.table}>
            <thead className={theme.styles.tableHeader}>
              <tr>
                {tableHeaders.map((header, idx) => (
                  <th key={idx} className={theme.styles.tableHeaderCell}>
                    {processInlineFormatting(header.trim())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className={theme.styles.tableBody}>
              {currentTable.map((row, rowIdx) => (
                <tr key={rowIdx} className={rowIdx % 2 === 0 ? theme.styles.tableRowEven : theme.styles.tableRowOdd}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className={theme.styles.tableCell}>
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
      const listClass = listType === 'ol' ? theme.styles.orderedList : theme.styles.unorderedList;
      elements.push(
        <ListTag key={`list-${index}`} className={listClass}>
          {currentList.map((item, idx) => (
            <li key={idx} className={theme.styles.listItem}>
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
        <blockquote key={`quote-${index}`} className={theme.styles.blockquote}>
          {currentQuote.map((line, idx) => (
            <p key={idx} className={theme.styles.blockquoteText}>
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
        return `<sup><a href="#footnote-${footnoteId}" class="${theme.styles.footnote}">[${footnoteId}]</a></sup>`;
      });
    }
    
    // Handle images: ![alt](src) - MUST BE BEFORE LINKS!
    const resolveImagePath = (imageSrc: string): string => {
      // If it's already an absolute URL or data URL, return as-is
      if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://') || imageSrc.startsWith('data:') || imageSrc.startsWith('/')) {
        return imageSrc;
      }
      
      // If basePath is provided and imageSrc is relative, resolve it
      if (options.basePath) {
        // Remove leading ./ if present
        const cleanSrc = imageSrc.replace(/^\.\//, '');
        const resolvedPath = `${options.basePath}/${cleanSrc}`;
        return resolvedPath;
      }
      
      return imageSrc;
    };

    // Enhanced image processing with size/style support
    // Supports: ![alt](src){width=300px height=200px class=custom-class}
    // Also supports: ![alt](src "title"){width=50%}
    const parseImageAttributes = (attributeStr: string) => {
      const attributes: Record<string, string> = {};
      
      // Parse {key=value key=value} format
      const attrRegex = /(\w+)=([^}\s]+)/g;
      let match;
      while ((match = attrRegex.exec(attributeStr)) !== null) {
        attributes[match[1]] = match[2];
      }
      
      return attributes;
    };

    const buildImageTag = (resolvedSrc: string, alt: string, title: string = '', attributes: Record<string, string> = {}) => {
      let className = theme.styles.image;
      let styleStr = '';
      let otherAttrs = '';
      
      // Handle custom class
      if (attributes.class) {
        className += ` ${attributes.class}`;
      }
      
      // Handle width and height
      const styleAttributes = [];
      if (attributes.width) {
        styleAttributes.push(`width: ${attributes.width}`);
      }
      if (attributes.height) {
        styleAttributes.push(`height: ${attributes.height}`);
      }
      if (attributes.maxWidth || attributes['max-width']) {
        styleAttributes.push(`max-width: ${attributes.maxWidth || attributes['max-width']}`);
      }
      if (attributes.maxHeight || attributes['max-height']) {
        styleAttributes.push(`max-height: ${attributes.maxHeight || attributes['max-height']}`);
      }
      
      if (styleAttributes.length > 0) {
        styleStr = ` style="${styleAttributes.join('; ')}"`;
      }
      
      // Handle other attributes like id
      if (attributes.id) {
        otherAttrs += ` id="${attributes.id}"`;
      }
      
      const titleAttr = title ? ` title="${title}"` : '';
      
      if (options.enableImageZoom) {
        return `<img src="${resolvedSrc}" alt="${alt}"${titleAttr} class="${className} cursor-pointer hover:shadow-lg transition-shadow"${styleStr}${otherAttrs} onclick="window.openImageModal && window.openImageModal('${resolvedSrc}', '${alt}')" />`;
      } else {
        return `<img src="${resolvedSrc}" alt="${alt}"${titleAttr} class="${className}"${styleStr}${otherAttrs} />`;
      }
    };

    // Enhanced regex to capture optional title and attributes
    // Matches: ![alt](src), ![alt](src "title"), ![alt](src){attrs}, ![alt](src "title"){attrs}
    text = text.replace(/!\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]*)")?\)(?:\{([^}]+)\})?/g, (match, alt, src, title, attrs) => {
      const resolvedSrc = resolveImagePath(src);
      const attributes = attrs ? parseImageAttributes(attrs) : {};
      return buildImageTag(resolvedSrc, alt, title, attributes);
    });
    
    // Handle links: [text](url) - MUST BE AFTER IMAGES!
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" target="_blank" rel="noopener noreferrer" class="${theme.styles.link}">$1</a>`);
    
    // Handle bold: **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, `<strong class="${theme.styles.bold}">$1</strong>`);
    
    // Handle italic: *text*
    text = text.replace(/\*([^*]+)\*/g, `<em class="${theme.styles.italic}">$1</em>`);
    
    // Handle strikethrough: ~~text~~
    text = text.replace(/~~([^~]+)~~/g, `<del class="${theme.styles.strikethrough}">$1</del>`);
    
    // Handle inline code: `code`
    text = text.replace(/`([^`]+)`/g, `<code class="${theme.styles.inlineCode}">$1</code>`);
    
    // Handle math: $equation$ (inline)
    text = text.replace(/\$([^$]+)\$/g, `<span class="${theme.styles.mathExpression}">$1</span>`);
    
    // Handle keyboard shortcuts: [[key]]
    text = text.replace(/\[\[([^\]]+)\]\]/g, `<kbd class="${theme.styles.keyboardKey}">$1</kbd>`);
    
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
          <div key={i} className={theme.styles.codeBlock}>
            <SyntaxHighlighter 
              language={codeLanguage} 
              style={codeTheme}
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
      elements.push(<hr key={i} className={theme.styles.horizontalRule} />);
      continue;
    }

    // Handle headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;

      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      
      if (options.enableToc) {
        tocItems.push({ id, text, level });
      }

      const createHeading = (level: number, text: string, index: number) => {
        const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
        const headingClass = theme.styles[`heading${level}` as keyof typeof theme.styles] as string;
        
        return (
          <HeadingTag key={index} id={id} className={headingClass}>
            {processInlineFormatting(text)}
          </HeadingTag>
        );
      };

      elements.push(createHeading(level, text, i));
      continue;
    }

    // Handle tables
    if (line.includes('|') && !isInList && !isInQuote) {
      flushList(i);
      flushQuote(i);
      isInList = false;
      isInQuote = false;

      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      
      if (!isInTable) {
        isInTable = true;
        tableHeaders = cells;
        continue;
      } else if (line.match(/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/)) {
        // Table separator line, skip
        continue;
      } else {
        currentTable.push(cells);
        continue;
      }
    } else if (isInTable) {
      flushTable(i);
      isInTable = false;
    }

    // Handle lists
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      flushTable(i);
      flushQuote(i);
      isInTable = false;
      isInQuote = false;

      const newListType = listMatch[2].match(/\d+\./) ? 'ol' : 'ul';
      
      if (!isInList || listType !== newListType) {
        if (isInList) {
          flushList(i);
        }
        isInList = true;
        listType = newListType;
        currentList = [];
      }
      
      currentList.push(listMatch[3]);
      continue;
    } else if (isInList) {
      flushList(i);
      isInList = false;
    }

    // Handle blockquotes
    if (line.startsWith('>')) {
      flushTable(i);
      flushList(i);
      isInTable = false;
      isInList = false;

      if (!isInQuote) {
        isInQuote = true;
        currentQuote = [];
      }
      
      currentQuote.push(line.substring(1).trim());
      continue;
    } else if (isInQuote) {
      flushQuote(i);
      isInQuote = false;
    }

    // Handle regular paragraphs
    if (trimmedLine) {
      flushTable(i);
      flushList(i);
      flushQuote(i);
      isInTable = false;
      isInList = false;
      isInQuote = false;

      elements.push(
        <p key={i} className={theme.styles.paragraph}>
          {processInlineFormatting(line)}
        </p>
      );
    }
  }

  // Flush any remaining elements
  flushTable(lines.length);
  flushList(lines.length);
  flushQuote(lines.length);

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
  enableFootnotes = true,
  enableThemes = true,
  defaultTheme = 'default',
  basePath
}: MarkdownRendererProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showToc, setShowToc] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{src: string; alt: string} | null>(null);
  const [currentTheme, setCurrentTheme] = useState<string>(defaultTheme);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const theme = getThemeById(currentTheme);

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
          const highlightedText = text.replace(regex, `<mark class="search-highlight ${theme.styles.searchHighlight}">$&</mark>`);
          const wrapper = document.createElement('span');
          wrapper.innerHTML = highlightedText;
          textNode.parentNode?.replaceChild(wrapper, textNode);
        }
      });
    }
  }, [searchQuery, theme.styles.searchHighlight]);

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

  const parseResult = parseMarkdown(content, theme, {
    enableToc,
    enableFootnotes,
    enableImageZoom,
    basePath
  });

  const { elements, tocItems } = parseResult;

  return (
    <div className={theme.styles.container}>
      {/* Header Controls */}
      <div className={theme.styles.headerControls}>
        <div className="flex items-center space-x-4">
          {enableToc && tocItems.length > 0 && (
            <button
              onClick={() => setShowToc(!showToc)}
              className={theme.styles.button}
            >
              <List className="w-4 h-4" />
              <span className="text-sm font-medium">Table of Contents</span>
            </button>
          )}
          
          {enableThemes && (
            <div className="relative">
              <button
                onClick={() => setShowThemeSelector(!showThemeSelector)}
                className={theme.styles.button}
              >
                <Palette className="w-4 h-4" />
                <span className="text-sm font-medium">{theme.name}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              
              {showThemeSelector && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                  <div className="p-3 border-b border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-800">Choose Theme</h3>
                  </div>
                  
                  {(['light', 'dark', 'colorful'] as const).map(category => (
                    <div key={category} className="p-2">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">
                        {category} Themes
                      </h4>
                      {getThemesByCategory(category).map(themeOption => (
                        <button
                          key={themeOption.id}
                          onClick={() => {
                            setCurrentTheme(themeOption.id);
                            setShowThemeSelector(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            currentTheme === themeOption.id
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <div className="font-medium">{themeOption.name}</div>
                          <div className="text-xs text-gray-500">{themeOption.description}</div>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
              className={theme.styles.input}
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
          <div className={theme.styles.tocSidebar}>
            <div className="sticky top-4 bg-white rounded-lg shadow-lg p-4 max-h-96 overflow-y-auto">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Contents</h3>
              <nav className="space-y-1">
                {tocItems.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={`${theme.styles.tocLink} ${
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
          <div className={theme.styles.content} ref={contentRef}>
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
      
      {/* Click outside to close theme selector */}
      {showThemeSelector && (
        <div 
          className="fixed inset-0 z-5" 
          onClick={() => setShowThemeSelector(false)}
        />
      )}
    </div>
  );
} 