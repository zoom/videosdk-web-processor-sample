import React, { useState, useEffect, useRef } from 'react';
import { Save, Edit3, Eye, RotateCcw, Download, Upload, Split, Maximize2, Minimize2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface MarkdownEditorProps {
  initialContent: string;
  processorType: string;
  processorId: string;
  onSave?: (content: string) => Promise<void>;
  onCancel?: () => void;
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
}

type ViewMode = 'edit' | 'preview' | 'split';

export default function MarkdownEditor({
  initialContent,
  processorType,
  processorId,
  onSave,
  onCancel,
  enableAutoSave = true,
  autoSaveInterval = 30000 // 30 seconds
}: MarkdownEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimeoutRef = useRef<number | null>(null);

  // Track unsaved changes
  useEffect(() => {
    setHasUnsavedChanges(content !== initialContent);
  }, [content, initialContent]);

  // Auto-save functionality
  useEffect(() => {
    if (!enableAutoSave || !hasUnsavedChanges) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave(true); // Auto-save
    }, autoSaveInterval);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [content, hasUnsavedChanges, enableAutoSave, autoSaveInterval]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'e':
            e.preventDefault();
            setViewMode('edit');
            break;
          case 'p':
            e.preventDefault();
            setViewMode('preview');
            break;
          case 'd':
            e.preventDefault();
            setViewMode('split');
            break;
          case 'f':
            e.preventDefault();
            setIsFullscreen(!isFullscreen);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleSave = async (isAutoSave = false) => {
    if (!onSave) return;
    
    setIsSaving(true);
    try {
      const result = await onSave(content);
      setLastSaved(new Date());
      if (!isAutoSave) {
        // Show success notification for manual saves
        console.log('Document saved successfully!', result);
        // You could add a toast notification here
        alert((result as any)?.message || 'Document saved successfully!');
      }
    } catch (error) {
      console.error('Failed to save document:', error);
      // Show error notification
      if (!isAutoSave) {
        alert('Failed to save document: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (hasUnsavedChanges && !window.confirm('Are you sure you want to discard all changes?')) {
      return;
    }
    setContent(initialContent);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${processorId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileContent = e.target?.result as string;
          setContent(fileContent);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = before + selectedText + after;
    
    const newContent = content.substring(0, start) + newText + content.substring(end);
    setContent(newContent);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const formatButtons = [
    { label: 'Bold', action: () => insertText('**', '**'), shortcut: 'Ctrl+B' },
    { label: 'Italic', action: () => insertText('*', '*'), shortcut: 'Ctrl+I' },
    { label: 'Code', action: () => insertText('`', '`'), shortcut: 'Ctrl+`' },
    { label: 'Link', action: () => insertText('[', '](url)'), shortcut: 'Ctrl+K' },
    { label: 'H1', action: () => insertText('# '), shortcut: 'Ctrl+1' },
    { label: 'H2', action: () => insertText('## '), shortcut: 'Ctrl+2' },
    { label: 'H3', action: () => insertText('### '), shortcut: 'Ctrl+3' },
    { label: 'List', action: () => insertText('- '), shortcut: 'Ctrl+L' },
    { label: 'Quote', action: () => insertText('> '), shortcut: 'Ctrl+Q' },
    { label: 'Code Block', action: () => insertText('```\n', '\n```'), shortcut: 'Ctrl+Shift+C' },
  ];

  const containerClass = isFullscreen 
    ? 'fixed inset-0 z-50 bg-white' 
    : 'h-[800px]';

  return (
    <div className={`${containerClass} flex flex-col border border-gray-200 rounded-lg`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Editing: {processorId}.md
          </h3>
          {hasUnsavedChanges && (
            <span className="text-sm text-orange-600 font-medium">● Unsaved changes</span>
          )}
          {lastSaved && (
            <span className="text-sm text-gray-500">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* View mode buttons */}
          <div className="flex bg-white rounded-md border border-gray-300 overflow-hidden">
            <button
              onClick={() => setViewMode('edit')}
              className={`px-3 py-2 text-sm flex items-center space-x-1 ${
                viewMode === 'edit' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Edit mode (Ctrl+E)"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-2 text-sm flex items-center space-x-1 border-x border-gray-300 ${
                viewMode === 'split' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Split mode (Ctrl+D)"
            >
              <Split className="w-4 h-4" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-2 text-sm flex items-center space-x-1 ${
                viewMode === 'preview' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
              title="Preview mode (Ctrl+P)"
            >
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
            title="Toggle fullscreen (Ctrl+F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          
          <button
            onClick={handleDownload}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
            title="Download as .md file"
          >
            <Download className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleUpload}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
            title="Upload .md file"
          >
            <Upload className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleReset}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md"
            title="Reset to original"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => handleSave()}
            disabled={isSaving || !hasUnsavedChanges}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Save (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Formatting toolbar */}
      {(viewMode === 'edit' || viewMode === 'split') && (
        <div className="flex items-center space-x-1 p-2 border-b border-gray-200 bg-gray-50 overflow-x-auto">
          {formatButtons.map((button, index) => (
            <button
              key={index}
              onClick={button.action}
              className="px-3 py-1 text-sm text-gray-700 hover:bg-gray-200 rounded border border-gray-300 whitespace-nowrap"
              title={`${button.label} (${button.shortcut})`}
            >
              {button.label}
            </button>
          ))}
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} flex flex-col`}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 p-4 font-mono text-sm border-none resize-none focus:outline-none"
              placeholder="Start writing your markdown documentation..."
              spellCheck={false}
              style={{
                lineHeight: '1.5',
                tabSize: 2,
              }}
            />
          </div>
        )}

        {/* Divider */}
        {viewMode === 'split' && (
          <div className="w-px bg-gray-300"></div>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-auto`}>
            <div className="p-4">
              <MarkdownRenderer
                content={content}
                loading={false}
                error={null}
                enableToc={true}
                enableSearch={true}
                enableImageZoom={true}
                enableFootnotes={true}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span>Lines: {content.split('\n').length}</span>
          <span>Characters: {content.length}</span>
          <span>Words: {content.split(/\s+/).filter(w => w.length > 0).length}</span>
        </div>
        
        <div className="flex items-center space-x-4">
          {enableAutoSave && (
            <span className="text-xs">
              Auto-save: {Math.round(autoSaveInterval / 1000)}s
            </span>
          )}
          <span className="text-xs">
            Markdown Editor v1.0
          </span>
        </div>
      </div>
    </div>
  );
} 