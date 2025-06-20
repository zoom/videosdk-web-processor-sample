# Zoom Dual Mask Video Processor

The **Zoom Dual Mask Video Processor** is a sophisticated video preprocessing solution that detects face regions in your video stream and applies background masking effects. This processor leverages MediaPipe's face detection capabilities to create professional-looking video effects.

## Features
- **Real-time face detection** using MediaPipe technology
- **Dynamic background masking** with customizable shapes
- **High-performance WebGL rendering** for smooth video processing
- **Configurable cropping shapes** (ellipse, rectangle)
- **Scalable face detection** with adjustable scale factors

## Installation

To use the Zoom Dual Mask Video Processor in your project, you need to include the processor file and MediaPipe assets:

```bash
# Include in your project
npm install @zoom/videosdk

# Ensure MediaPipe assets are available
cp -r mediapipe-assets/ public/assets/mediapipe/
```

## Basic Usage

Here's how to implement the Dual Mask Video Processor in your VideoSDK application:

```javascript
import { ZoomVideo } from '@zoom/videosdk';

// Initialize the video stream
const stream = ZoomVideo.createStream();

// Create the processor
const processor = stream.createProcessor({
  url: 'https://your-domain.com/zoom-dual-mask-video-processor.js',
  name: 'zoom-dual-mask-video-processor',
  type: 'video',
  options: {
    assetsUrlBase: '/assets/mediapipe',
    croppingShape: 'ELLIPSE', // or 'RECTANGLE'
    scaleFactor: 1.0,
    useAngle: false,
    zoomVideo: false
  }
});

// Add the processor to the stream
await stream.addProcessor(processor);

// Start the video stream
await stream.startVideo();
```

## Configuration Options

The processor accepts several configuration options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `assetsUrlBase` | string | Required | Base URL for MediaPipe assets |
| `croppingShape` | string | 'ELLIPSE' | Shape of the face mask ('ELLIPSE' or 'RECTANGLE') |
| `scaleFactor` | number | 1.0 | Scale factor for face detection |
| `useAngle` | boolean | false | Whether to use face angle detection |
| `zoomVideo` | boolean | false | Enable zoom video functionality |

## Advanced Usage

### Updating Background Image

You can dynamically update the background image during runtime:

```javascript
// Create an ImageBitmap from your background image
const backgroundImage = await createImageBitmap(imageFile);

// Update the processor's background
processor.port.postMessage({
  cmd: 'update_mask_background_image',
  data: backgroundImage
});
```

### Updating Options

Processor options can be updated dynamically:

```javascript
processor.port.postMessage({
  cmd: 'update_options',
  data: {
    croppingShape: 'RECTANGLE',
    scaleFactor: 1.2
  }
});
```

## Implementation Details

The processor works by:

1. **Initializing MediaPipe** face detection models
2. **Processing each video frame** to detect face regions
3. **Applying dynamic masking** based on detected faces
4. **Compositing the result** with the background image
5. **Outputting the processed frame** to the video stream

### Performance Considerations

- The processor uses WebGL 2.0 for optimal performance
- Face detection runs on every frame for real-time results
- Memory usage scales with video resolution
- Recommended maximum resolution: 1920x1080

## Browser Compatibility

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | 88+ | ✅ Full |
| Firefox | 85+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 88+ | ✅ Full |

## Troubleshooting

### Common Issues

**Processor not loading:**
- Ensure MediaPipe assets are accessible at the specified URL
- Check browser console for CORS errors
- Verify processor file is served correctly

**Poor detection accuracy:**
- Adjust the `scaleFactor` option
- Ensure adequate lighting conditions
- Check if face is clearly visible in the frame

**Performance issues:**
- Reduce video resolution if possible
- Check if WebGL 2.0 is supported
- Monitor CPU usage during processing

## Example Implementation

Here's a complete example of implementing the processor in a React component:

```javascript
import React, { useEffect, useRef } from 'react';
import { ZoomVideo } from '@zoom/videosdk';

function DualMaskVideoComponent() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const processorRef = useRef(null);

  useEffect(() => {
    const initializeVideo = async () => {
      try {
        // Create stream
        const stream = ZoomVideo.createStream();
        streamRef.current = stream;

        // Create processor
        const processor = stream.createProcessor({
          url: '/zoom-dual-mask-video-processor.js',
          name: 'zoom-dual-mask-video-processor',
          type: 'video',
          options: {
            assetsUrlBase: '/assets/mediapipe',
            croppingShape: 'ELLIPSE',
            scaleFactor: 1.0
          }
        });
        processorRef.current = processor;

        // Add processor and start video
        await stream.addProcessor(processor);
        await stream.startVideo();

        // Attach to video element
        if (videoRef.current) {
          stream.attachVideo(videoRef.current);
        }
      } catch (error) {
        console.error('Failed to initialize dual mask video:', error);
      }
    };

    initializeVideo();

    return () => {
      // Cleanup
      if (processorRef.current && streamRef.current) {
        streamRef.current.removeProcessor(processorRef.current);
      }
      if (streamRef.current) {
        streamRef.current.stopVideo();
      }
    };
  }, []);

  return (
    <div>
      <video ref={videoRef} autoPlay muted />
    </div>
  );
}

export default DualMaskVideoComponent;
```

## Support

For additional support and documentation, please refer to:
- [Zoom VideoSDK Documentation](https://developers.zoom.us/docs/video-sdk/)
- [MediaPipe Documentation](https://developers.google.com/mediapipe)
- [WebGL Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) 