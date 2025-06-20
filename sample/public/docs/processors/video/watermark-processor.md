# Watermark Video Processor

The **Watermark Video Processor** allows you to add custom watermarks, logos, or text overlays to your video streams in real-time. This processor supports various image formats and provides flexible positioning options.

---

## Features Overview

- ✅ **Real-time watermark rendering** with hardware acceleration
- ✅ **Multiple image formats** (PNG, JPG, SVG, WebP)
- ✅ **Dynamic positioning** and scaling options
- ✅ **Transparency support** for professional overlay effects
- ✅ **Performance optimized** for smooth video streaming

## Quick Start Checklist

Before you begin, make sure you have:

- [ ] Zoom VideoSDK installed and configured
- [ ] Watermark image files prepared
- [ ] Basic understanding of video processors
- [x] Read this documentation

## Installation

Install the required dependencies:

```bash
npm install @zoom/videosdk
```

For development with custom watermarks:

```bash
# Optional: Image processing utilities
npm install canvas fabric
```

## Basic Usage

Here's a simple example to get you started:

```javascript
import { ZoomVideo } from '@zoom/videosdk';

const stream = ZoomVideo.createStream();

const processor = stream.createProcessor({
  url: '/watermark-processor.js',
  name: 'watermark-processor',
  type: 'video',
  options: {
    watermarkUrl: '/assets/logo.png',
    position: 'bottom-right',
    opacity: 0.7,
    scale: 0.2
  }
});

await stream.addProcessor(processor);
```

## Configuration Options

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `watermarkUrl` | string | Required | URL or path to watermark image |
| `position` | string | 'bottom-right' | Watermark position on video |
| `opacity` | number | 1.0 | Transparency level (0.0 - 1.0) |
| `scale` | number | 1.0 | Scale factor for watermark size |
| `offsetX` | number | 10 | Horizontal offset in pixels |
| `offsetY` | number | 10 | Vertical offset in pixels |

### Position Values

The `position` parameter accepts these values:

1. **Corner positions:**
   - `top-left`
   - `top-right`
   - `bottom-left`  
   - `bottom-right`

2. **Edge positions:**
   - `top-center`
   - `bottom-center`
   - `left-center`
   - `right-center`

3. **Special positions:**
   - `center` (absolute center)
   - `custom` (use offsetX/offsetY)

## Advanced Configuration

### Dynamic Watermark Updates

You can update the watermark image during runtime:

```javascript
// Create an ImageBitmap from a new image
const newWatermark = await createImageBitmap(imageFile);

// Update the processor
processor.port.postMessage({
  cmd: 'update_watermark_image',
  data: newWatermark
});
```

### Multi-layered Watermarks

> **Pro Tip:** You can stack multiple watermark layers by using multiple processor instances with different configurations.

For complex watermarking scenarios:

```javascript
const logoProcessor = stream.createProcessor({
  url: '/watermark-processor.js',
  name: 'logo-watermark',
  type: 'video',
  options: {
    watermarkUrl: '/assets/company-logo.png',
    position: 'top-left',
    opacity: 0.8
  }
});

const timestampProcessor = stream.createProcessor({
  url: '/watermark-processor.js', 
  name: 'timestamp-watermark',
  type: 'video',
  options: {
    watermarkUrl: '/assets/timestamp.png',
    position: 'bottom-right',
    opacity: 0.9
  }
});
```

## Performance Considerations

### Optimization Tips

**Image Format Recommendations:**

- **PNG**: Best for logos with transparency
- **WebP**: Best compression with transparency support  
- **SVG**: Best for scalable graphics *(limited browser support)*
- **JPG**: Smallest file size *(no transparency)*

**Performance Guidelines:**

- Keep watermark images under **500KB** for optimal performance
- Use dimensions that are **power of 2** (256x256, 512x512) when possible
- Consider using **WebP format** for better compression
- Avoid ~~frequent updates~~ to watermark images during streaming

### Memory Usage

| Image Size | Estimated Memory | Recommended Use |
|------------|------------------|-----------------|
| 128x128    | ~65KB           | Small logos     |
| 256x256    | ~256KB          | Medium logos    |
| 512x512    | ~1MB            | Large watermarks|
| 1024x1024  | ~4MB            | ⚠️ Not recommended |

## Code Examples

### React Integration

```jsx
import React, { useState, useRef, useEffect } from 'react';

function WatermarkVideoPlayer() {
  const [watermarkFile, setWatermarkFile] = useState(null);
  const processorRef = useRef(null);
  
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const imageBitmap = await createImageBitmap(file);
      
      if (processorRef.current) {
        processorRef.current.port.postMessage({
          cmd: 'update_watermark_image',
          data: imageBitmap
        });
      }
    }
  };

  return (
    <div className="watermark-controls">
      <input 
        type="file" 
        accept="image/*" 
        onChange={handleFileChange}
      />
      <video ref={videoRef} autoPlay muted />
    </div>
  );
}
```

### Vue.js Integration

```vue
<template>
  <div class="watermark-processor">
    <input @change="updateWatermark" type="file" accept="image/*" />
    <video ref="videoElement" autoplay muted></video>
  </div>
</template>

<script>
export default {
  data() {
    return {
      processor: null
    };
  },
  methods: {
    async updateWatermark(event) {
      const file = event.target.files[0];
      if (file && this.processor) {
        const bitmap = await createImageBitmap(file);
        this.processor.port.postMessage({
          cmd: 'update_watermark_image',
          data: bitmap
        });
      }
    }
  }
};
</script>
```

## Browser Support

| Browser | Version | Canvas 2D | WebGL | Notes |
|---------|---------|-----------|-------|--------|
| Chrome | 88+ | ✅ | ✅ | Full support |
| Firefox | 85+ | ✅ | ✅ | Full support |
| Safari | 14+ | ✅ | ⚠️ | Limited WebGL |
| Edge | 88+ | ✅ | ✅ | Full support |

> **Note:** Safari has limited WebGL support which may affect performance with large watermarks.

## Troubleshooting

### Common Issues

**Watermark not appearing:**

1. Check if the watermark image URL is accessible
2. Verify the image format is supported
3. Ensure the processor is properly initialized

**Performance issues:**

1. Reduce watermark image size
2. Lower the opacity value
3. Use WebP format instead of PNG

**Memory leaks:**

1. Always call `removeProcessor()` when done
2. Dispose of ImageBitmap objects properly
3. Monitor memory usage in development tools

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `WATERMARK_LOAD_FAILED` | Failed to load watermark image | Check image URL and format |
| `CANVAS_CONTEXT_ERROR` | Cannot get 2D rendering context | Browser compatibility issue |
| `INVALID_POSITION` | Invalid position parameter | Use valid position values |

### Debug Mode

Enable detailed logging:

```javascript
const processor = stream.createProcessor({
  // ... other options
  options: {
    watermarkUrl: '/logo.png',
    debug: true,  // Enable debug logging
    logLevel: 'verbose'
  }
});
```

## API Reference

### Methods

#### `updateWatermarkImage(imageBitmap)`

Updates the watermark image dynamically.

**Parameters:**
- `imageBitmap` (ImageBitmap): The new watermark image

**Example:**
```javascript
const newImage = await createImageBitmap(file);
processor.port.postMessage({
  cmd: 'update_watermark_image',
  data: newImage
});
```

#### `updatePosition(position, offsetX, offsetY)`

Updates watermark position.

**Parameters:**
- `position` (string): New position
- `offsetX` (number): Horizontal offset  
- `offsetY` (number): Vertical offset

### Events

The processor emits these events:

- `watermark_loaded` - Watermark image loaded successfully
- `watermark_error` - Error loading watermark  
- `position_updated` - Position changed
- `processor_ready` - Processor initialization complete

## Best Practices

### Design Guidelines

1. **Keep it subtle** - Watermarks should not distract from the main content
2. **Use appropriate opacity** - 0.6-0.8 works well for most cases  
3. **Consider contrast** - Ensure watermark is visible on various backgrounds
4. **Size appropriately** - Scale should be 0.1-0.3 of video dimensions

### Development Tips

- Test with different video resolutions
- Consider mobile device performance  
- Use version control for watermark assets
- Implement fallback images for critical watermarks

---

## Support & Resources

For additional help:

- 📖 [Zoom VideoSDK Documentation](https://developers.zoom.us/docs/video-sdk/)
- 🎥 [Video Processing Guide](https://example.com/video-guide)  
- 💬 [Community Forum](https://devforum.zoom.us/)
- 🐛 [Report Issues](https://github.com/zoom/videosdk/issues)

**Last updated:** *December 2024* 