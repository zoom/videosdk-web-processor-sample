import { useState, useEffect } from 'react';
import { loadMarkdownFile } from '../utils/markdownApi';

interface UseMarkdownLoaderResult {
  content: string | null;
  loading: boolean;
  error: string | null;
  version: 'original' | 'modified' | null;
  source: 'server' | 'original' | 'localStorage' | null;
}

export function useMarkdownLoader(
  processorType: string, 
  processorId: string
): UseMarkdownLoaderResult {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<'original' | 'modified' | null>(null);
  const [source, setSource] = useState<'server' | 'original' | 'localStorage' | null>(null);

  useEffect(() => {
    const loadMarkdown = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Priority 1: Try to load from server API (modified version has priority)
        try {
          const response = await fetch(`/api/docs/load/${processorType}/${processorId}`);
          
          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              setContent(result.content);
              setVersion(result.version);
              setSource(result.source);
              return; // Success, exit early
            }
          }
        } catch (apiError) {
          console.warn('Server API not available, trying fallback methods:', apiError);
        }

        // Priority 2: Try to load from localStorage drafts
        const savedContent = await loadMarkdownFile(processorType, processorId);
        if (savedContent) {
          setContent(savedContent);
          setVersion('modified');
          setSource('localStorage');
          return; // Success, exit early
        }

        // Priority 3: Try to load from public directory (original file)
        const markdownPath = `/docs/processors/${processorType}/${processorId}.md`;
        const response = await fetch(markdownPath);
        
        if (!response.ok) {
          throw new Error(`Failed to load markdown: ${response.status}`);
        }
        
        const markdownContent = await response.text();
        setContent(markdownContent);
        setVersion('original');
        setSource('original');
        
      } catch (err) {
        console.warn(`No markdown file found for ${processorType}/${processorId}:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
        setContent(null);
        setVersion(null);
        setSource(null);
      } finally {
        setLoading(false);
      }
    };

    if (processorType && processorId) {
      loadMarkdown();
    }
  }, [processorType, processorId]);

  return { content, loading, error, version, source };
} 