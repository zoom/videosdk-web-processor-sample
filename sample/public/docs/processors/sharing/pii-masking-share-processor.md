# PII Masking Share Processor

## Overview

The **PII Masking Share Processor** is a WebGL2-based processor that applies Gaussian blur to specified regions of shared screen content in real-time. This processor is designed to protect Personally Identifiable Information (PII) during screen sharing sessions by selectively blurring sensitive areas.

## Features

- **Real-time Performance**: Uses WebGL2 for high-performance GPU-accelerated processing
- **Selective Blurring**: Apply blur effects only to specified rectangular regions
- **Customizable Blur Intensity**: Adjustable blur radius for different privacy needs
- **Interactive Region Selection**: Visual region editor with mouse-based selection
- **WebGL Context Recovery**: Automatic handling of WebGL context loss scenarios
- **Async API Compatible**: Fully compatible with Zoom Video SDK's async processor APIs

## Technical Specifications

### Processor Type
- **Type**: Share Processor
- **Target**: Screen sharing streams
- **Rendering**: WebGL2 fragment shaders

### Performance
- **GPU Acceleration**: Yes (WebGL2)
- **Context Optimization**: High-performance power preference
- **Resource Management**: Automatic cleanup and context recovery

### Browser Support
- **WebGL2 Required**: Modern browsers with WebGL2 support
- **Fallback**: Graceful degradation with context loss handling

## Usage

### Basic Integration

```javascript
// 1. Create the processor
const processor = await mediaStream.createProcessor({
  url: '/pii-masking-share-processor.js',
  type: 'share',
  name: 'pii-masking-share-processor',
  options: {
    blurRegionNorm: {
      x: 0.2,        // Left position (0-1, normalized)
      y: 0.2,        // Top position (0-1, normalized)  
      width: 0.6,    // Width (0-1, normalized)
      height: 0.6    // Height (0-1, normalized)
    },
    blurRadius: 10   // Blur intensity (pixels)
  }
});

// 2. Add processor to media stream (async)
await mediaStream.addProcessor(processor);

// 3. Update blur settings
processor.port.postMessage({
  command: 'update-blur-options',
  blurRegionNorm: {
    x: 0.1,
    y: 0.1, 
    width: 0.8,
    height: 0.8
  },
  blurRadius: 15
});

// 4. Remove processor when done (async)
await mediaStream.removeProcessor(processor);
```

### React Component Integration

```tsx
import React, { useState, useCallback } from 'react';

function PiiMaskProcessor({ 
  processor, 
  isSharing, 
  createProcessor, 
  removeProcessor 
}) {
  const [isActive, setIsActive] = useState(false);
  const [blurRegion, setBlurRegion] = useState({
    x: 0.2, y: 0.2, width: 0.6, height: 0.6
  });
  const [blurRadius, setBlurRadius] = useState(10);

  const startProcessor = useCallback(async () => {
    if (!processor && createProcessor) {
      await createProcessor();
    }
    
    if (processor) {
      processor.port.postMessage({
        command: 'update-blur-options',
        blurRegionNorm: blurRegion,
        blurRadius: blurRadius
      });
      setIsActive(true);
    }
  }, [processor, createProcessor, blurRegion, blurRadius]);

  const stopProcessor = useCallback(async () => {
    if (removeProcessor) {
      await removeProcessor();
    }
    setIsActive(false);
  }, [removeProcessor]);

  return (
    <div className="pii-mask-controls">
      <button onClick={isActive ? stopProcessor : startProcessor}>
        {isActive ? 'Stop' : 'Start'} PII Masking
      </button>
      
      <div className="blur-controls">
        <label>
          Blur Radius: 
          <input 
            type="range" 
            min="1" 
            max="30" 
            value={blurRadius}
            onChange={(e) => setBlurRadius(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
```

## Configuration Options

### Initialization Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `blurRegionNorm` | Object | `{x: 0.2, y: 0.2, width: 0.6, height: 0.6}` | Normalized coordinates for blur region |
| `blurRadius` | Number | `10` | Blur intensity in pixels |

### Blur Region Properties

| Property | Type | Range | Description |
|----------|------|-------|-------------|
| `x` | Number | 0.0 - 1.0 | Left position (normalized) |
| `y` | Number | 0.0 - 1.0 | Top position (normalized) |
| `width` | Number | 0.0 - 1.0 | Region width (normalized) |
| `height` | Number | 0.0 - 1.0 | Region height (normalized) |

### Runtime Commands

#### Update Blur Options
```javascript
processor.port.postMessage({
  command: 'update-blur-options',
  blurRegionNorm: {
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8
  },
  blurRadius: 20
});
```

## Implementation Details

### WebGL2 Shaders

The processor uses a three-pass rendering pipeline:

1. **Horizontal Blur Pass**: Applies horizontal Gaussian blur
2. **Vertical Blur Pass**: Applies vertical Gaussian blur
3. **Composite Pass**: Combines original and blurred content based on region

### Gaussian Blur Algorithm

- **Kernel Size**: 9-tap Gaussian kernel
- **Sigma Calculation**: Based on blur radius parameter
- **Weight Normalization**: Automatic weight calculation and normalization

### Context Management

#### WebGL Context Configuration
```javascript
const gl = canvas.getContext("webgl2", {
  antialias: false,
  depth: false,
  stencil: false,
  alpha: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  powerPreference: "high-performance",
  failIfMajorPerformanceCaveat: false
});
```

#### Context Loss Handling
- **Event Listeners**: Automatic registration for `webglcontextlost` and `webglcontextrestored`
- **Recovery**: Automatic re-initialization on context restoration
- **Graceful Degradation**: Frame skipping during context loss

### Resource Management

#### Cleanup on Uninit
- Textures (original, intermediate, output)
- Framebuffers (horizontal and vertical blur)
- Vertex Array Objects and buffers
- Shader programs and uniforms
- Event listeners

#### Memory Optimization
- Immediate resource release
- Explicit GL state reset
- Force GPU sync with `flush()` and `finish()`

## Performance Considerations

### Optimization Tips

1. **Region Size**: Smaller blur regions perform better
2. **Blur Radius**: Lower radius values improve performance
3. **Update Frequency**: Minimize configuration changes during active processing
4. **Context Stability**: Ensure stable WebGL context to avoid re-initialization overhead

### Performance Monitoring

```javascript
// Monitor processor performance
let frameCount = 0;
let startTime = performance.now();

// In processFrame method
frameCount++;
if (frameCount % 60 === 0) {
  const elapsed = performance.now() - startTime;
  const fps = 60000 / elapsed;
  console.log(`PII Processor FPS: ${fps.toFixed(1)}`);
  startTime = performance.now();
}
```

## Troubleshooting

### Common Issues

#### WebGL Context Lost
**Symptoms**: Black screen or processing stops
**Solutions**:
- Check browser WebGL2 support
- Monitor GPU memory usage
- Implement context loss event handling
- Reduce concurrent WebGL applications

#### Poor Performance
**Symptoms**: Low FPS or frame drops
**Solutions**:
- Reduce blur radius
- Minimize blur region size
- Check GPU capabilities
- Monitor system resources

#### Processor Not Starting
**Symptoms**: No blur effect visible
**Solutions**:
- Verify async processor creation
- Check `update-blur-options` message timing
- Ensure WebGL2 context initialization
- Validate region coordinates (0-1 range)

### Debug Logging

Enable detailed logging for troubleshooting:

```javascript
// Enable processor debug logging
processor.port.postMessage({
  command: 'set-debug',
  enabled: true
});
```

### Browser DevTools

Use browser developer tools to monitor:
- WebGL context status
- GPU memory usage
- Performance timeline
- Console errors and warnings

## Browser Compatibility

### Supported Browsers
- **Chrome**: 56+ (WebGL2 support)
- **Firefox**: 51+ (WebGL2 support)  
- **Safari**: 15+ (WebGL2 support)
- **Edge**: 79+ (Chromium-based)

### Feature Detection
```javascript
function isWebGL2Supported() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  return !!gl;
}

if (!isWebGL2Supported()) {
  console.warn('WebGL2 not supported, PII masking unavailable');
}
```

## Security Considerations

### Privacy Protection
- **Real-time Processing**: No data leaves the client
- **Local Execution**: All processing happens in browser
- **No Storage**: No frame data is stored or transmitted

### Performance Impact
- **GPU Resources**: Uses dedicated GPU processing
- **Memory Usage**: Minimal additional memory overhead
- **CPU Impact**: Minimal CPU usage due to GPU acceleration

## API Reference

### Processor Events

#### Context Lost
```javascript
processor.addEventListener('contextlost', (event) => {
  console.warn('WebGL context lost, will reinitialize');
});
```

#### Context Restored  
```javascript
processor.addEventListener('contextrestored', (event) => {
  console.log('WebGL context restored');
});
```

### Error Handling

```javascript
try {
  await mediaStream.addProcessor(processor);
} catch (error) {
  console.error('Failed to add PII processor:', error);
  // Handle processor creation failure
}
```

## Version History

### v1.0.0
- Initial release with basic PII masking
- WebGL2 Gaussian blur implementation
- Interactive region selection

### v1.1.0
- Added WebGL context loss handling
- Improved resource cleanup
- Performance optimizations
- Async API compatibility

### v1.2.0
- Enhanced error handling
- Better browser compatibility
- Improved documentation
- Debug logging support

## License

This processor is part of the Zoom Video SDK Web Processor Sample and follows the same licensing terms.

## Support

For technical support and questions:
- Check the [Zoom Video SDK Documentation](https://developers.zoom.us/docs/video-sdk/)
- Review the [GitHub Issues](https://github.com/zoom/videosdk-web-sample)
- Contact Zoom Developer Support
