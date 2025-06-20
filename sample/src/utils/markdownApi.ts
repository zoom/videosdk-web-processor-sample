// Markdown API utilities for saving and loading markdown files

export interface SaveMarkdownRequest {
  processorType: string;
  processorId: string;
  content: string;
}

export interface SaveMarkdownResponse {
  success: boolean;
  message: string;
  lastModified?: string;
}

/**
 * Save markdown content to a file
 * In a real application, this would make an API call to your server
 * For now, we'll simulate the save operation and use localStorage as backup
 */
export async function saveMarkdownFile(request: SaveMarkdownRequest): Promise<SaveMarkdownResponse> {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // OPTION 1: Real server API (enabled for persistent saving)
    try {
      const response = await fetch('/api/docs/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Clear localStorage draft since it's now saved to file
      const key = `markdown_${request.processorType}_${request.processorId}`;
      localStorage.removeItem(key);
      
      return {
        success: true,
        message: 'Markdown file saved successfully to disk!',
        lastModified: result.lastModified
      };
    } catch (serverError) {
      console.warn('Server save failed, falling back to localStorage:', serverError);
      
      // FALLBACK: localStorage if server fails
      const key = `markdown_${request.processorType}_${request.processorId}`;
      const data = {
        content: request.content,
        lastModified: new Date().toISOString(),
        processorType: request.processorType,
        processorId: request.processorId
      };
      
      localStorage.setItem(key, JSON.stringify(data));
      
      return {
        success: true,
        message: 'Server unavailable. Saved to browser storage as backup.',
        lastModified: data.lastModified
      };
         }
  } catch (error) {
    console.error('Failed to save markdown:', error);
    return {
      success: false,
      message: 'Failed to save markdown file: ' + (error instanceof Error ? error.message : 'Unknown error')
    };
  }
}

/**
 * Load markdown content from storage/server
 */
export async function loadMarkdownFile(processorType: string, processorId: string): Promise<string | null> {
  try {
    // First try to load from localStorage (saved drafts)
    const key = `markdown_${processorType}_${processorId}`;
    const saved = localStorage.getItem(key);
    
    if (saved) {
      const data = JSON.parse(saved);
      // Check if the saved version is recent (within 24 hours)
      const lastModified = new Date(data.lastModified);
      const now = new Date();
      const hoursDiff = (now.getTime() - lastModified.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        return data.content;
      }
    }
    
    // If no saved version or it's old, return null to load from original source
    return null;
  } catch (error) {
    console.error('Failed to load saved markdown:', error);
    return null;
  }
}

/**
 * Check if there are unsaved changes for a processor
 */
export function hasUnsavedChanges(processorType: string, processorId: string): boolean {
  try {
    const key = `markdown_${processorType}_${processorId}`;
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Clear saved drafts for a processor
 */
export function clearSavedDraft(processorType: string, processorId: string): void {
  try {
    const key = `markdown_${processorType}_${processorId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear saved draft:', error);
  }
}

/**
 * List all saved drafts
 */
export function getSavedDrafts(): Array<{processorType: string, processorId: string, lastModified: string}> {
  try {
    const drafts = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('markdown_')) {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.processorType && data.processorId && data.lastModified) {
          drafts.push({
            processorType: data.processorType,
            processorId: data.processorId,
            lastModified: data.lastModified
          });
        }
      }
    }
    return drafts.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  } catch (error) {
    console.error('Failed to get saved drafts:', error);
    return [];
  }
}

/**
 * Export all markdown files as a ZIP (requires JSZip library)
 * This is a placeholder for a more advanced feature
 */
export async function exportAllMarkdown(): Promise<void> {
  try {
    // In a real implementation, you might use JSZip:
    // const JSZip = await import('jszip');
    // const zip = new JSZip.default();
    
    console.log('Export functionality would be implemented here');
    alert('Export functionality is not yet implemented. Each file can be downloaded individually.');
  } catch (error) {
    console.error('Failed to export markdown files:', error);
  }
}

/**
 * Validate markdown content for common issues
 */
export function validateMarkdown(content: string): Array<{line: number, message: string, type: 'error' | 'warning'}> {
  const issues: Array<{line: number, message: string, type: 'error' | 'warning'}> = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    // Check for common markdown issues
    
    // Unmatched code blocks
    if (line.startsWith('```') && !content.includes('```', content.indexOf(line) + line.length)) {
      issues.push({
        line: lineNumber,
        message: 'Unclosed code block',
        type: 'error'
      });
    }
    
    // Missing alt text for images
    if (line.includes('![](') && !line.includes('![alt](')) {
      issues.push({
        line: lineNumber,
        message: 'Image missing alt text',
        type: 'warning'
      });
    }
    
    // Empty links
    if (line.includes('[](') || line.includes('](url)')) {
      issues.push({
        line: lineNumber,
        message: 'Empty or placeholder link',
        type: 'warning'
      });
    }
    
    // Very long lines (over 120 characters)
    if (line.length > 120) {
      issues.push({
        line: lineNumber,
        message: 'Line exceeds recommended length (120 characters)',
        type: 'warning'
      });
    }
  }
  
  return issues;
} 