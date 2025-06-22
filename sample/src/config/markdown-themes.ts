// Import code themes dynamically to avoid TypeScript issues
const codeThemes = {
  dracula: 'dracula',
  github: 'github', 
  vs: 'vs',
  okaidia: 'okaidia',
  synthwave84: 'synthwave84'
} as const;

export interface MarkdownTheme {
  id: string;
  name: string;
  description: string;
  category: 'light' | 'dark' | 'colorful';
  codeTheme: string; // Prism theme name
  styles: {
    // Container styles
    container: string;
    content: string;
    
    // Typography
    heading1: string;
    heading2: string;
    heading3: string;
    heading4: string;
    heading5: string;
    heading6: string;
    paragraph: string;
    
    // Text formatting
    bold: string;
    italic: string;
    strikethrough: string;
    inlineCode: string;
    
    // Links and images
    link: string;
    image: string;
    
    // Lists
    orderedList: string;
    unorderedList: string;
    listItem: string;
    
    // Tables
    table: string;
    tableHeader: string;
    tableHeaderCell: string;
    tableBody: string;
    tableRow: string;
    tableRowEven: string;
    tableRowOdd: string;
    tableCell: string;
    
    // Blockquotes
    blockquote: string;
    blockquoteText: string;
    
    // Code blocks
    codeBlock: string;
    
    // UI elements
    horizontalRule: string;
    footnote: string;
    mathExpression: string;
    keyboardKey: string;
    
    // Search and navigation
    searchHighlight: string;
    tocSidebar: string;
    tocLink: string;
    tocLinkActive: string;
    
    // Controls
    headerControls: string;
    button: string;
    input: string;
  };
}

export const markdownThemes: MarkdownTheme[] = [
  // Default Theme (Light)
  {
    id: 'default',
    name: 'Default',
    description: 'Clean and minimal light theme',
    category: 'light',
    codeTheme: 'github',
    styles: {
      container: 'relative',
      content: 'bg-white rounded-2xl shadow-lg p-8',
      
      heading1: 'text-3xl font-bold text-gray-900 mb-6 pb-2 border-b border-gray-200',
      heading2: 'text-2xl font-semibold text-gray-800 mb-4 mt-8',
      heading3: 'text-xl font-semibold text-gray-800 mb-3 mt-6',
      heading4: 'text-lg font-semibold text-gray-700 mb-2 mt-4',
      heading5: 'text-base font-semibold text-gray-700 mb-2 mt-3',
      heading6: 'text-sm font-semibold text-gray-600 mb-2 mt-2',
      paragraph: 'text-gray-600 leading-relaxed mb-4',
      
      bold: 'font-semibold text-gray-900',
      italic: 'italic',
      strikethrough: 'line-through',
      inlineCode: 'bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800',
      
      link: 'text-blue-600 hover:text-blue-800 underline',
      image: 'max-w-full h-auto my-4 rounded-lg shadow-md',
      
      orderedList: 'my-4 list-decimal list-inside space-y-2',
      unorderedList: 'my-4 list-disc list-inside space-y-2',
      listItem: 'text-gray-600 leading-relaxed pl-2',
      
      table: 'min-w-full divide-y divide-gray-200 border border-gray-300',
      tableHeader: 'bg-gray-50',
      tableHeaderCell: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0',
      tableBody: 'bg-white divide-y divide-gray-200',
      tableRow: '',
      tableRowEven: 'bg-white',
      tableRowOdd: 'bg-gray-50',
      tableCell: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200 last:border-r-0',
      
      blockquote: 'my-6 pl-4 border-l-4 border-blue-500 bg-blue-50 py-2 pr-4',
      blockquoteText: 'text-gray-700 italic leading-relaxed mb-2 last:mb-0',
      
      codeBlock: 'my-4',
      
      horizontalRule: 'my-8 border-t border-gray-300',
      footnote: 'text-blue-600 hover:text-blue-800 text-xs',
      mathExpression: 'bg-yellow-50 px-2 py-1 rounded text-sm font-mono border',
      keyboardKey: 'px-2 py-1 bg-gray-200 border border-gray-300 rounded text-xs font-mono shadow-sm',
      
      searchHighlight: 'bg-yellow-200 px-1 rounded',
      tocSidebar: 'w-64 flex-shrink-0',
      tocLink: 'block text-sm text-gray-600 hover:text-blue-600 transition-colors',
      tocLinkActive: 'text-blue-600 font-medium',
      
      headerControls: 'flex items-center justify-between mb-6 p-4 bg-gray-50 rounded-lg',
      button: 'flex items-center space-x-2 px-3 py-2 bg-white rounded-md shadow-sm hover:shadow-md transition-shadow',
      input: 'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
    }
  },

  // Dark Theme
  {
    id: 'dark',
    name: 'Dark',
    description: 'Elegant dark theme for night reading',
    category: 'dark',
    codeTheme: 'dracula',
    styles: {
      container: 'relative',
      content: 'bg-gray-900 rounded-2xl shadow-lg p-8',
      
      heading1: 'text-3xl font-bold text-white mb-6 pb-2 border-b border-gray-700',
      heading2: 'text-2xl font-semibold text-gray-100 mb-4 mt-8',
      heading3: 'text-xl font-semibold text-gray-100 mb-3 mt-6',
      heading4: 'text-lg font-semibold text-gray-200 mb-2 mt-4',
      heading5: 'text-base font-semibold text-gray-200 mb-2 mt-3',
      heading6: 'text-sm font-semibold text-gray-300 mb-2 mt-2',
      paragraph: 'text-gray-300 leading-relaxed mb-4',
      
      bold: 'font-semibold text-white',
      italic: 'italic',
      strikethrough: 'line-through',
      inlineCode: 'bg-gray-800 px-2 py-1 rounded text-sm font-mono text-green-400',
      
      link: 'text-blue-400 hover:text-blue-300 underline',
      image: 'max-w-full h-auto my-4 rounded-lg shadow-md',
      
      orderedList: 'my-4 list-decimal list-inside space-y-2',
      unorderedList: 'my-4 list-disc list-inside space-y-2',
      listItem: 'text-gray-300 leading-relaxed pl-2',
      
      table: 'min-w-full divide-y divide-gray-700 border border-gray-600',
      tableHeader: 'bg-gray-800',
      tableHeaderCell: 'px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider border-r border-gray-600 last:border-r-0',
      tableBody: 'bg-gray-900 divide-y divide-gray-700',
      tableRow: '',
      tableRowEven: 'bg-gray-900',
      tableRowOdd: 'bg-gray-800',
      tableCell: 'px-6 py-4 whitespace-nowrap text-sm text-gray-300 border-r border-gray-600 last:border-r-0',
      
      blockquote: 'my-6 pl-4 border-l-4 border-purple-500 bg-purple-900/20 py-2 pr-4',
      blockquoteText: 'text-gray-300 italic leading-relaxed mb-2 last:mb-0',
      
      codeBlock: 'my-4',
      
      horizontalRule: 'my-8 border-t border-gray-700',
      footnote: 'text-blue-400 hover:text-blue-300 text-xs',
      mathExpression: 'bg-yellow-900/30 px-2 py-1 rounded text-sm font-mono border border-yellow-700',
      keyboardKey: 'px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs font-mono shadow-sm text-gray-200',
      
      searchHighlight: 'bg-yellow-600 px-1 rounded text-black',
      tocSidebar: 'w-64 flex-shrink-0',
      tocLink: 'block text-sm text-gray-400 hover:text-blue-400 transition-colors',
      tocLinkActive: 'text-blue-400 font-medium',
      
      headerControls: 'flex items-center justify-between mb-6 p-4 bg-gray-800 rounded-lg',
      button: 'flex items-center space-x-2 px-3 py-2 bg-gray-700 text-gray-200 rounded-md shadow-sm hover:shadow-md hover:bg-gray-600 transition-all',
      input: 'px-3 py-2 border border-gray-600 bg-gray-800 text-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
    }
  },

  // GitHub Theme
  {
    id: 'github',
    name: 'GitHub',
    description: 'GitHub-style documentation theme',
    category: 'light',
    codeTheme: 'github',
    styles: {
      container: 'relative',
      content: 'bg-white rounded-lg border border-gray-200 p-8',
      
      heading1: 'text-3xl font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200',
      heading2: 'text-2xl font-semibold text-gray-900 mb-3 mt-6 pb-1 border-b border-gray-200',
      heading3: 'text-xl font-semibold text-gray-900 mb-3 mt-5',
      heading4: 'text-lg font-semibold text-gray-900 mb-2 mt-4',
      heading5: 'text-base font-semibold text-gray-900 mb-2 mt-3',
      heading6: 'text-sm font-semibold text-gray-700 mb-2 mt-2',
      paragraph: 'text-gray-700 leading-relaxed mb-4',
      
      bold: 'font-semibold',
      italic: 'italic',
      strikethrough: 'line-through',
      inlineCode: 'bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800',
      
      link: 'text-blue-600 hover:underline',
      image: 'max-w-full h-auto my-4',
      
      orderedList: 'my-4 pl-6 space-y-1',
      unorderedList: 'my-4 pl-6 space-y-1',
      listItem: 'text-gray-700 leading-relaxed',
      
      table: 'min-w-full border-collapse border border-gray-300',
      tableHeader: 'bg-gray-50',
      tableHeaderCell: 'px-4 py-2 text-left font-semibold text-gray-900 border border-gray-300',
      tableBody: 'bg-white',
      tableRow: '',
      tableRowEven: 'bg-white',
      tableRowOdd: 'bg-gray-50',
      tableCell: 'px-4 py-2 text-gray-700 border border-gray-300',
      
      blockquote: 'my-4 pl-4 border-l-4 border-gray-300 text-gray-600',
      blockquoteText: 'leading-relaxed mb-2 last:mb-0',
      
      codeBlock: 'my-4',
      
      horizontalRule: 'my-6 border-t border-gray-300',
      footnote: 'text-blue-600 hover:underline text-xs',
      mathExpression: 'bg-blue-50 px-2 py-1 rounded text-sm font-mono border border-blue-200',
      keyboardKey: 'px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono',
      
      searchHighlight: 'bg-yellow-200 px-1',
      tocSidebar: 'w-64 flex-shrink-0',
      tocLink: 'block text-sm text-gray-600 hover:text-blue-600 transition-colors py-1',
      tocLinkActive: 'text-blue-600 font-medium',
      
      headerControls: 'flex items-center justify-between mb-6 p-3 bg-gray-50 border border-gray-200 rounded-md',
      button: 'flex items-center space-x-2 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors',
      input: 'px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
    }
  },

  // Terminal Theme
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Retro terminal-style theme',
    category: 'dark',
    codeTheme: 'okaidia',
    styles: {
      container: 'relative',
      content: 'bg-black rounded-lg border-2 border-green-500 p-8 font-mono',
      
      heading1: 'text-2xl font-bold text-green-400 mb-6 pb-2 border-b border-green-500',
      heading2: 'text-xl font-bold text-green-400 mb-4 mt-8',
      heading3: 'text-lg font-bold text-green-400 mb-3 mt-6',
      heading4: 'text-base font-bold text-green-400 mb-2 mt-4',
      heading5: 'text-sm font-bold text-green-400 mb-2 mt-3',
      heading6: 'text-xs font-bold text-green-400 mb-2 mt-2',
      paragraph: 'text-green-300 leading-relaxed mb-4',
      
      bold: 'font-bold text-green-200',
      italic: 'italic',
      strikethrough: 'line-through',
      inlineCode: 'bg-green-900/30 px-2 py-1 rounded text-sm text-green-200 border border-green-700',
      
      link: 'text-cyan-400 hover:text-cyan-300 underline',
      image: 'max-w-full h-auto my-4 rounded border border-green-500',
      
      orderedList: 'my-4 list-decimal list-inside space-y-2',
      unorderedList: 'my-4 list-disc list-inside space-y-2',
      listItem: 'text-green-300 leading-relaxed pl-2',
      
      table: 'min-w-full divide-y divide-green-700 border border-green-500',
      tableHeader: 'bg-green-900/50',
      tableHeaderCell: 'px-4 py-2 text-left text-xs font-bold text-green-400 uppercase tracking-wider border-r border-green-700 last:border-r-0',
      tableBody: 'bg-black divide-y divide-green-800',
      tableRow: '',
      tableRowEven: 'bg-black',
      tableRowOdd: 'bg-green-900/20',
      tableCell: 'px-4 py-2 whitespace-nowrap text-sm text-green-300 border-r border-green-700 last:border-r-0',
      
      blockquote: 'my-6 pl-4 border-l-4 border-cyan-500 bg-cyan-900/20 py-2 pr-4',
      blockquoteText: 'text-green-300 italic leading-relaxed mb-2 last:mb-0',
      
      codeBlock: 'my-4',
      
      horizontalRule: 'my-8 border-t border-green-500',
      footnote: 'text-cyan-400 hover:text-cyan-300 text-xs',
      mathExpression: 'bg-yellow-900/30 px-2 py-1 rounded text-sm font-mono border border-yellow-700 text-yellow-400',
      keyboardKey: 'px-2 py-1 bg-green-900/50 border border-green-600 rounded text-xs font-mono text-green-200',
      
      searchHighlight: 'bg-yellow-500 px-1 rounded text-black',
      tocSidebar: 'w-64 flex-shrink-0',
      tocLink: 'block text-sm text-green-400 hover:text-cyan-400 transition-colors',
      tocLinkActive: 'text-cyan-400 font-bold',
      
      headerControls: 'flex items-center justify-between mb-6 p-4 bg-green-900/20 border border-green-700 rounded-lg',
      button: 'flex items-center space-x-2 px-3 py-2 bg-green-900/30 text-green-300 rounded-md border border-green-600 hover:bg-green-800/30 transition-all',
      input: 'px-3 py-2 border border-green-600 bg-black text-green-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
    }
  },

  // Material Theme
  {
    id: 'material',
    name: 'Material',
    description: 'Google Material Design inspired theme',
    category: 'light',
    codeTheme: 'vs',
    styles: {
      container: 'relative',
      content: 'bg-white rounded-2xl shadow-xl p-8',
      
      heading1: 'text-3xl font-light text-gray-900 mb-6 pb-2 border-b border-blue-200',
      heading2: 'text-2xl font-light text-gray-800 mb-4 mt-8',
      heading3: 'text-xl font-normal text-gray-800 mb-3 mt-6',
      heading4: 'text-lg font-normal text-gray-700 mb-2 mt-4',
      heading5: 'text-base font-medium text-gray-700 mb-2 mt-3',
      heading6: 'text-sm font-medium text-gray-600 mb-2 mt-2',
      paragraph: 'text-gray-700 leading-relaxed mb-4',
      
      bold: 'font-medium text-gray-900',
      italic: 'italic',
      strikethrough: 'line-through',
      inlineCode: 'bg-blue-50 px-2 py-1 rounded text-sm font-mono text-blue-800',
      
      link: 'text-blue-600 hover:text-blue-800 no-underline hover:underline',
      image: 'max-w-full h-auto my-4 rounded-lg shadow-lg',
      
      orderedList: 'my-4 list-decimal list-inside space-y-2',
      unorderedList: 'my-4 list-disc list-inside space-y-2',
      listItem: 'text-gray-700 leading-relaxed pl-2',
      
      table: 'min-w-full shadow-lg rounded-lg overflow-hidden',
      tableHeader: 'bg-blue-500',
      tableHeaderCell: 'px-6 py-4 text-left text-sm font-medium text-white uppercase tracking-wider',
      tableBody: 'bg-white',
      tableRow: '',
      tableRowEven: 'bg-white',
      tableRowOdd: 'bg-blue-50',
      tableCell: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900',
      
      blockquote: 'my-6 pl-4 border-l-4 border-blue-500 bg-blue-50 py-3 pr-4 rounded-r-lg',
      blockquoteText: 'text-gray-700 leading-relaxed mb-2 last:mb-0',
      
      codeBlock: 'my-4',
      
      horizontalRule: 'my-8 border-t border-gray-200',
      footnote: 'text-blue-600 hover:text-blue-800 text-xs',
      mathExpression: 'bg-orange-50 px-2 py-1 rounded text-sm font-mono border border-orange-200',
      keyboardKey: 'px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono shadow-sm',
      
      searchHighlight: 'bg-yellow-200 px-1 rounded',
      tocSidebar: 'w-64 flex-shrink-0',
      tocLink: 'block text-sm text-gray-600 hover:text-blue-600 transition-colors py-1',
      tocLinkActive: 'text-blue-600 font-medium',
      
      headerControls: 'flex items-center justify-between mb-6 p-4 bg-blue-50 rounded-lg',
      button: 'flex items-center space-x-2 px-4 py-2 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow text-blue-600',
      input: 'px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm'
    }
  },

  // Synthwave Theme
  {
    id: 'synthwave',
    name: 'Synthwave',
    description: 'Retro 80s synthwave aesthetic',
    category: 'colorful',
    codeTheme: 'synthwave84',
    styles: {
      container: 'relative',
      content: 'bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl shadow-2xl p-8 border border-pink-500/30',
      
      heading1: 'text-3xl font-bold bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent mb-6 pb-2 border-b border-pink-500/50',
      heading2: 'text-2xl font-bold bg-gradient-to-r from-pink-300 to-cyan-300 bg-clip-text text-transparent mb-4 mt-8',
      heading3: 'text-xl font-bold text-pink-300 mb-3 mt-6',
      heading4: 'text-lg font-bold text-cyan-300 mb-2 mt-4',
      heading5: 'text-base font-bold text-purple-300 mb-2 mt-3',
      heading6: 'text-sm font-bold text-indigo-300 mb-2 mt-2',
      paragraph: 'text-gray-200 leading-relaxed mb-4',
      
      bold: 'font-bold text-pink-300',
      italic: 'italic',
      strikethrough: 'line-through',
      inlineCode: 'bg-black/50 px-2 py-1 rounded text-sm font-mono text-cyan-400 border border-cyan-500/30',
      
      link: 'text-cyan-400 hover:text-pink-400 underline transition-colors',
      image: 'max-w-full h-auto my-4 rounded-lg shadow-2xl border border-pink-500/30',
      
      orderedList: 'my-4 list-decimal list-inside space-y-2',
      unorderedList: 'my-4 list-disc list-inside space-y-2',
      listItem: 'text-gray-200 leading-relaxed pl-2',
      
      table: 'min-w-full border border-pink-500/50 rounded-lg overflow-hidden',
      tableHeader: 'bg-gradient-to-r from-pink-600 to-purple-600',
      tableHeaderCell: 'px-6 py-3 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-pink-400/50 last:border-r-0',
      tableBody: 'bg-black/30',
      tableRow: '',
      tableRowEven: 'bg-black/30',
      tableRowOdd: 'bg-purple-900/30',
      tableCell: 'px-6 py-4 whitespace-nowrap text-sm text-gray-200 border-r border-pink-500/30 last:border-r-0',
      
      blockquote: 'my-6 pl-4 border-l-4 border-cyan-500 bg-cyan-900/20 py-2 pr-4 rounded-r-lg',
      blockquoteText: 'text-gray-200 italic leading-relaxed mb-2 last:mb-0',
      
      codeBlock: 'my-4',
      
      horizontalRule: 'my-8 border-t border-gradient-to-r from-pink-500 to-cyan-500',
      footnote: 'text-cyan-400 hover:text-pink-400 text-xs',
      mathExpression: 'bg-yellow-900/30 px-2 py-1 rounded text-sm font-mono border border-yellow-500/50 text-yellow-400',
      keyboardKey: 'px-2 py-1 bg-black/50 border border-pink-500/50 rounded text-xs font-mono text-pink-300',
      
      searchHighlight: 'bg-yellow-400 px-1 rounded text-black',
      tocSidebar: 'w-64 flex-shrink-0',
      tocLink: 'block text-sm text-gray-300 hover:text-cyan-400 transition-colors',
      tocLinkActive: 'text-cyan-400 font-bold',
      
      headerControls: 'flex items-center justify-between mb-6 p-4 bg-black/30 border border-pink-500/30 rounded-lg',
      button: 'flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-md shadow-lg hover:shadow-xl transition-all',
      input: 'px-3 py-2 border border-cyan-500/50 bg-black/50 text-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-400'
    }
  }
];

export const getThemeById = (id: string): MarkdownTheme => {
  return markdownThemes.find(theme => theme.id === id) || markdownThemes[0];
};

export const getThemesByCategory = (category: 'light' | 'dark' | 'colorful') => {
  return markdownThemes.filter(theme => theme.category === category);
}; 