# Markdown Editor Demo

Welcome to the **Markdown Editor**! This is a demonstration of the new online editing functionality.

## Features

### 🎨 Rich Text Editing
- **Bold text** and *italic text*
- `inline code` and code blocks
- [Links](https://example.com) and images
- Lists and tables

### 📝 Editor Capabilities
- **Live Preview**: See your changes in real-time
- **Split View**: Edit and preview side by side
- **Syntax Highlighting**: Markdown syntax highlighting in the editor
- **Auto-save**: Automatically saves your work every 30 seconds
- **Keyboard Shortcuts**: 
  - `Ctrl+S` - Save
  - `Ctrl+E` - Edit mode
  - `Ctrl+P` - Preview mode
  - `Ctrl+D` - Split mode
  - `Ctrl+F` - Toggle fullscreen

### 🔧 Formatting Tools
Use the toolbar buttons to quickly format your text:

| Button | Function | Shortcut |
|--------|----------|----------|
| **Bold** | Make text bold | `Ctrl+B` |
| *Italic* | Make text italic | `Ctrl+I` |
| `Code` | Inline code | `Ctrl+`` |
| Link | Insert link | `Ctrl+K` |
| H1-H3 | Headers | `Ctrl+1-3` |
| List | Bullet list | `Ctrl+L` |
| Quote | Blockquote | `Ctrl+Q` |

## Code Examples

Here's some sample code to test the editor:

```javascript
// Example processor configuration
const processorConfig = {
  name: 'Demo Processor',
  version: '1.0.0',
  description: 'A demo processor for testing',
  
  initialize: function() {
    console.log('Processor initialized');
  },
  
  process: function(data) {
    return data.map(item => ({
      ...item,
      processed: true
    }));
  }
};
```

```typescript
interface ProcessorOptions {
  enabled: boolean;
  quality: 'low' | 'medium' | 'high';
  filters: string[];
}

class VideoProcessor {
  private options: ProcessorOptions;
  
  constructor(options: ProcessorOptions) {
    this.options = options;
  }
  
  process(frame: VideoFrame): VideoFrame {
    if (!this.options.enabled) {
      return frame;
    }
    
    // Apply filters
    return this.applyFilters(frame);
  }
  
  private applyFilters(frame: VideoFrame): VideoFrame {
    // Implementation here
    return frame;
  }
}
```

## Mathematical Expressions

You can include mathematical expressions using the `$` syntax:

The quadratic formula is: $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$

## Task Lists

- [x] Create markdown editor component
- [x] Add syntax highlighting
- [x] Implement auto-save functionality
- [x] Add keyboard shortcuts
- [ ] Add collaborative editing
- [ ] Implement version history
- [ ] Add export to multiple formats

## Images and Media

![Video SDK Logo](../../../images/videosdk.gif)

## Blockquotes

> **Note**: This is a demonstration of the markdown editor capabilities. You can edit this content directly in the browser and see the changes in real-time.

## Tables

| Feature | Status | Priority |
|---------|--------|----------|
| Markdown Rendering | ✅ Complete | High |
| Online Editing | ✅ Complete | High |
| Auto-save | ✅ Complete | Medium |
| Collaborative Editing | ⏳ Planned | Low |
| Version Control | ⏳ Planned | Medium |

## Keyboard Shortcuts Reference

Press these key combinations to quickly access editor features:

- [[Ctrl]] + [[S]] - Save document
- [[Ctrl]] + [[E]] - Switch to edit mode
- [[Ctrl]] + [[P]] - Switch to preview mode
- [[Ctrl]] + [[D]] - Split view mode
- [[Ctrl]] + [[F]] - Toggle fullscreen
- [[Ctrl]] + [[Z]] - Undo
- [[Ctrl]] + [[Y]] - Redo

## Footnotes

This editor supports footnotes[^1] which can be very useful for additional information[^2].

[^1]: Footnotes appear at the bottom of the document
[^2]: They provide additional context without cluttering the main text

## Get Started

1. Click the **"Edit Documentation"** button in the toolbar
2. Start editing this content
3. Use the split view to see your changes in real-time
4. Save your work using `Ctrl+S` or the Save button
5. Switch between edit/preview modes as needed

Happy editing! 🎉 