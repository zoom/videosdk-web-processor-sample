import { useCallback, useState, useRef, useContext, useEffect } from 'react';
import type { Processor } from '@zoom/videosdk';
import { Button, Select, Input, Checkbox } from 'antd';
import ZoomContext from '../../context/zoom-context';
import ZoomMediaContext from '../../context/media-context';

import './processor.scss';

const { Option } = Select;

interface AppProps {
  useVideoPlayer?: string;
}

const ProcessorContainer = (props: AppProps) => {
  const [videoOn, setVideoOn] = useState(false);
  const [rendererType, setRendererType] = useState<'2D' | 'WebGL' | 'WebGL2'>('2D');
  const [shape, setShape] = useState<'1' | '0'>('1');
  const [scaleFactor, setScaleFactor] = useState<number>(1.0);
  const [useAngle, setUseAngle] = useState<boolean>(false);
  const [zoomVideo, setZoomVideo] = useState<boolean>(false);
  const [watermarkUrl, setWatermarkUrl] = useState<string>('https://videosdk.zoomdev.us/2.1.5/lib/watermark.svg'); //
  const [selectedProcessor, setSelectedProcessor] = useState<string>('zoom-dual-mask-video-processor'); // 新增

  const isSwitching = useRef(false);
  const processorMapRef = useRef(new Map<string, Processor>());

  const { mediaStream } = useContext(ZoomMediaContext);
  const zmClient = useContext(ZoomContext);

  const selfVideoRef = useRef(null);
  const processorRef = useRef<Processor | undefined>();

  const handleToggleVideo = async () => {
    if (isSwitching.current) {
      return;
    }
    isSwitching.current = true;
    const user = zmClient.getCurrentUserInfo();
    if (!videoOn) {
      setVideoOn(true);
      await mediaStream?.startVideo({ hd: true, fps: 24, originalRatio: true });
      await mediaStream?.attachVideo(user.userId, 3, selfVideoRef.current!);
    } else {
      setVideoOn(false);
      await mediaStream?.stopVideo();
      await mediaStream?.detachVideo(user.userId, selfVideoRef.current!);
    }
    isSwitching.current = false;
  };

  const loadImageBitmap = (src: string) => {
    const testImage = document.createElement('img');
    testImage.width = 640;
    testImage.height = 360;
    testImage.crossOrigin = 'anonymous';
    testImage.src = src;
    return new Promise((resolve) => {
      testImage.onload = () => {
        resolve(createImageBitmap(testImage));
      };
    });
  };

  const selectVideoProcessor =
    (name: string, url: string, options: any, initCallback: (port: MessagePort) => void) => async () => {
      setSelectedProcessor(name); // 更新选中的 Processor
      if (processorRef.current) {
        mediaStream?.removeProcessor(processorRef.current);
      }
      const processorMap = processorMapRef.current;
      let processor = processorMap.get(name);
      if (!processor) {
        processor = await mediaStream?.createProcessor({
          url,
          type: 'video',
          name,
          options
        });
      }
      if (!processor) {
        throw new Error('Processor creation failed');
      }
      processorMap.set(name, processor);
      processorRef.current = processor;
      mediaStream?.addProcessor(processor);
      initCallback(processor.port);
    };

  const handleWatermarkUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWatermarkUrl(e.target.value); // 更新输入框内容状态
  };

  useEffect(() => {
    if (selectedProcessor === 'zoom-dual-mask-video-processor') {
      processorMapRef.current.get('zoom-dual-mask-video-processor')?.port.postMessage({
        cmd: 'update_options',
        data: {
          croppingShape: parseInt(shape, 10),
          scaleFactor: scaleFactor,
          useAngle: useAngle,
          zoomVideo: zoomVideo
        }
      });
    }
  }, [shape, scaleFactor, useAngle, zoomVideo, selectedProcessor]);

  useEffect(() => {
    if (selectedProcessor === 'watermark-processor') {
      const processor = processorMapRef.current.get('watermark-processor');
      if (processor) {
        loadImageBitmap(watermarkUrl).then((imageBitmap) => {
          processor.port.postMessage({
            cmd: 'update_watermark_image',
            data: imageBitmap
          });
        });
      }
    }
  }, [watermarkUrl, selectedProcessor]);

  return (
    <div className="js-processor-view">
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 42px)',
          gap: '20px'
        }}
      >
        {/* Video Section */}
        <div
          className="processor-preview-video"
          style={{
            width: '1280px',
            height: '720px',
            backgroundColor: '#000',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <video-player-container class="video-player-container">
            <video-player class="video-player" ref={selfVideoRef} style={{ width: '100%', height: '100%' }} />
          </video-player-container>
        </div>

        {/* Configuration Area */}
        <div
          style={{
            border: '1px solid #ccc',
            padding: '10px',
            width: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <h3 style={{ margin: 0 }}>{selectedProcessor} Config</h3>

          {selectedProcessor === 'zoom-dual-mask-video-processor' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <label>Renderer Type:</label>
                <Select value={rendererType} onChange={(value) => setRendererType(value)} style={{ width: '100%' }}>
                  <Option value="2D">2D</Option>
                  <Option value="WebGL">WebGL</Option>
                  <Option value="WebGL2">WebGL2</Option>
                </Select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <label>Shape:</label>
                <Select value={shape} onChange={(value) => setShape(value)} style={{ width: '100%' }}>
                  <Option value="1">Ellipse</Option>
                  <Option value="0">Circle</Option>
                </Select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <label>Scale Factor:</label>
                <Input
                  type="number"
                  step="0.1"
                  value={scaleFactor}
                  onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Checkbox checked={useAngle} onChange={(e) => setUseAngle(e.target.checked)}>
                  Use Angle
                </Checkbox>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <Checkbox checked={zoomVideo} onChange={(e) => setZoomVideo(e.target.checked)}>
                  Zoom Video
                </Checkbox>
              </div>
            </>
          )}

          {selectedProcessor === 'watermark-processor' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <label>Watermark URL:</label>
              <Input
                placeholder="Enter watermark image URL"
                value={watermarkUrl}
                onChange={handleWatermarkUrlChange}
                style={{ width: '100%' }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Control Buttons */}
      <div style={{ marginTop: '10px' }}>
        <Button onClick={handleToggleVideo} style={{ marginRight: '10px' }}>
          {!videoOn ? 'Start' : 'Stop'} Video
        </Button>
        <Button
          onClick={selectVideoProcessor(
            'zoom-dual-mask-video-processor',
            'https://rwgdev200.zoomdev.us:10086/processors/zoom-dual-mask-video-processor.js',
            {
              assetsUrlBase: 'https://rwgdev200.zoomdev.us:10086/processors/assets/mediapipe'
            },
            async (port: MessagePort) => {
              port.postMessage({
                cmd: 'mask_background_image',
                data: await loadImageBitmap(
                  'https://interactive-examples.mdn.mozilla.net/media/cc0-images/grapefruit-slice-332-332.jpg'
                ),
                rendererType,
                shape,
                scaleFactor,
                zoomVideo
              });
            }
          )}
        >
          DualMaskProcessor
        </Button>
        <Button
          onClick={selectVideoProcessor(
            'watermark-processor',
            'https://rwgdev200.zoomdev.us:10086/processors/watermark-processor.js',
            {},
            async (port: MessagePort) => {
              port.postMessage({
                cmd: 'update_watermark_image',
                data: await loadImageBitmap('https://videosdk.zoomdev.us/2.1.5/lib/watermark.svg')
              });
            }
          )}
        >
          WatermarkProcessor
        </Button>
      </div>
    </div>
  );
};

export default ProcessorContainer;
