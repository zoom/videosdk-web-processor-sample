import {
  type HTMLAttributes,
  type DetailedHTMLProps,
  type DOMAttributes,
  useEffect,
  useContext,
  useState,
  useCallback,
  useReducer,
  useMemo,
  useRef,
} from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import ZoomVideo, {
  type VideoPlayerContainer,
  type VideoPlayer,
  ConnectionState,
  ReconnectReason,
  Processor,
} from "@zoom/videosdk";
import {
  Video,
  AudioLines,
  Share2,
  Play,
  Volume2,
  Link,
  Wand2,
} from "lucide-react";
import MediaProcessors from "./MediaProcessors";
import ProcessorDetail from "./components/ProcessorDetail";
import produce from "immer";
import ZoomContext from "./context/zoom-context";
import type { MediaStream } from "./index-types";
import ZoomMediaContext from "./context/media-context";
import { useSelectProcessor } from "./hooks/useSelectProcessor";

type CustomElement<T> = Partial<T & DOMAttributes<T> & { children: any }>;

interface AppProps {
  meetingArgs: {
    sdkKey: string;
    topic: string;
    signature: string;
    name: string;
    password?: string;
    webEndpoint?: string;
    enforceGalleryView?: string;
    enforceVB?: string;
    customerJoinId?: string;
    lang?: string;
    useVideoPlayer?: string;
  };
}
const mediaShape = {
  audio: {
    encode: false,
    decode: false,
  },
  video: {
    encode: false,
    decode: false,
  },
  share: {
    encode: false,
    decode: false,
  },
};
const mediaReducer = produce((draft, action) => {
  switch (action.type) {
    case "audio-encode": {
      draft.audio.encode = action.payload;
      break;
    }
    case "audio-decode": {
      draft.audio.decode = action.payload;
      break;
    }
    case "video-encode": {
      draft.video.encode = action.payload;
      break;
    }
    case "video-decode": {
      draft.video.decode = action.payload;
      break;
    }
    case "share-encode": {
      draft.share.encode = action.payload;
      break;
    }
    case "share-decode": {
      draft.share.decode = action.payload;
      break;
    }
    case "reset-media": {
      Object.assign(draft, { ...mediaShape });
      break;
    }
    default:
      break;
  }
}, mediaShape);

declare global {
  interface Window {
    webEndpoint: string | undefined;
    zmClient: any | undefined;
    mediaStream: any | undefined;
    crossOriginIsolated: boolean;
    ltClient: any | undefined;
    logClient: any | undefined;
  }
  namespace JSX {
    interface IntrinsicElements {
      ["video-player"]: DetailedHTMLProps<
        HTMLAttributes<VideoPlayer>,
        VideoPlayer
      > & { class?: string };
      ["video-player-container"]: CustomElement<VideoPlayerContainer> & {
        class?: string;
      };
    }
  }
}

function HomePage({ loading }: { loading: boolean }) {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        backgroundImage:
          'url("https://images.unsplash.com/photo-1509023464722-18d996393ca8?auto=format&fit=crop&q=80")',
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-white bg-opacity-90"></div>

      {/* Floating Icons */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 animate-float-slow">
          <Video className="w-12 h-12 text-blue-500 opacity-50" />
        </div>
        <div className="absolute top-1/3 right-1/4 animate-float-medium">
          <AudioLines className="w-10 h-10 text-purple-500 opacity-50" />
        </div>
        <div className="absolute bottom-1/3 left-1/3 animate-float-fast">
          <Share2 className="w-8 h-8 text-indigo-500 opacity-50" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 text-center">
        <div className="flex items-center justify-center mb-8 min-h-[5rem] py-2">
          <Wand2 className="w-12 h-12 text-blue-500 mr-4 animate-pulse" />
          <h1 className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 leading-normal">
            Amazing media processors from Zoom!
          </h1>
        </div>
        <p className="text-xl text-gray-600 mb-8">
          Transform your media with our powerful processing tools. Edit,
          convert, and share with ease.
        </p>
        <button
          onClick={() => !loading && navigate("/processors")}
          className={`group px-8 py-4 text-white text-xl font-semibold rounded-lg transition-all duration-300 transform relative overflow-hidden bg-gradient-to-r from-blue-500 to-indigo-500 ${
            loading
              ? "cursor-not-allowed opacity-75"
              : "hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-200"
          }`}
          disabled={loading}
        >
          <span className="relative z-10 flex items-center justify-center">
            <span className={loading ? "animate-pulse" : ""}>
              {loading ? "Loading..." : "Explore"}
            </span>
            {!loading && (
              <Play className="w-6 h-6 ml-2 transform group-hover:translate-x-1 transition-transform" />
            )}
          </span>
          {!loading && (
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          )}
        </button>
      </div>

      {/* Logo at bottom center */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
        <img src="/logo.svg" alt="Logo" className="h-5" />
      </div>
    </div>
  );
}

function App(props: AppProps) {
  const {
    meetingArgs: {
      sdkKey,
      topic,
      signature,
      name,
      password,
      webEndpoint: webEndpointArg,
      enforceGalleryView,
      enforceVB,
      customerJoinId,
      lang,
      useVideoPlayer,
    },
  } = props;
  const [loading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("");
  const [isFailover, setIsFailover] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("closed");
  const [mediaState, dispatch] = useReducer(mediaReducer, mediaShape);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isSupportGalleryView, setIsSupportGalleryView] =
    useState<boolean>(false);
  const zmClient = useContext(ZoomContext);
  let webEndpoint: any;
  if (webEndpointArg) {
    webEndpoint = webEndpointArg;
  } else {
    webEndpoint = window?.webEndpoint ?? "zoom.us";
  }

  const [selectedVideoProcessor, selectVideoProcessor, videoProcessorMapRef] =
    useSelectProcessor("video");

  const [selectedAudioProcessor, selectAudioProcessor, audioProcessorMapRef] =
    useSelectProcessor("audio");

  const mediaContext = useMemo(
    () => ({
      ...mediaState,
      mediaStream,
      selectVideoProcessor,
      selectedVideoProcessor,
      videoProcessorMapRef,
      selectedAudioProcessor,
      selectAudioProcessor,
      audioProcessorMapRef,
    }),
    [
      mediaState,
      mediaStream,
      selectedAudioProcessor,
      selectVideoProcessor,
      selectAudioProcessor,
    ]
  );
  const galleryViewWithoutSAB =
    Number(enforceGalleryView) === 1 && !window.crossOriginIsolated;
  const vbWithoutSAB = Number(enforceVB) === 1 && !window.crossOriginIsolated;
  const galleryViewWithAttach =
    Number(useVideoPlayer) === 1 &&
    (window.crossOriginIsolated || galleryViewWithoutSAB);

  if (galleryViewWithAttach) {
    console.log({
      galleryViewWithAttach,
      use: "<video-player-container> video tag render video",
      doc: "https://marketplacefront.zoom.us/sdk/custom/web/modules/Stream.html#attachVideo",
    });
  } else {
    console.log({
      galleryViewWithAttach,
      use: "<canvas>",
      doc: "https://marketplacefront.zoom.us/sdk/custom/web/modules/Stream.html#startVideo",
    });
  }
  useEffect(() => {
    const init = async () => {
      const dependentAssets = localStorage.getItem("dependent_assets_version")
        ? `https://d27xp8zu78jmsf.cloudfront.net/web-media/${localStorage.getItem(
            "version"
          )}`
        : `${window.location.origin}/lib`;

      await zmClient.init("en-US", dependentAssets, {
        webEndpoint,
        enforceMultipleVideos: galleryViewWithoutSAB,
        enforceVirtualBackground: vbWithoutSAB,
        stayAwake: true,
        patchJsMedia: true,
        leaveOnPageUnload: false,
      });
      try {
        setLoadingText("Joining the session...");
        await zmClient.join(topic, signature, name, password).catch((e) => {
          console.log(e);
        });
        const stream = zmClient.getMediaStream();
        setMediaStream(stream);
        setIsSupportGalleryView(stream.isSupportMultipleVideos());
        setIsLoading(false);
      } catch (e: any) {
        setIsLoading(false);
        // message.error(e.reason);
      }
    };
    init();
    return () => {
      if (zmClient.getSessionInfo()?.isInMeeting) {
        ZoomVideo.destroyClient();
      }
    };
  }, [
    sdkKey,
    signature,
    zmClient,
    topic,
    name,
    password,
    webEndpoint,
    galleryViewWithoutSAB,
    customerJoinId,
    lang,
    vbWithoutSAB,
  ]);
  const onConnectionChange = useCallback(
    (payload: any) => {
      if (payload.state === ConnectionState.Reconnecting) {
        setIsLoading(true);
        setIsFailover(true);
        setStatus("connecting");
        const { reason, subsessionName } = payload;
        if (reason === ReconnectReason.Failover) {
          setLoadingText("Session Disconnected,Try to reconnect");
        } else if (
          reason === ReconnectReason.JoinSubsession ||
          reason === ReconnectReason.MoveToSubsession
        ) {
          setLoadingText(`Joining ${subsessionName}...`);
        } else if (reason === ReconnectReason.BackToMainSession) {
          setLoadingText("Returning to Main Session...");
        }
      } else if (payload.state === ConnectionState.Connected) {
        setStatus("connected");
        if (isFailover) {
          setIsLoading(false);
        }
        window.zmClient = zmClient;
        window.mediaStream = zmClient.getMediaStream();

        console.log("getSessionInfo", zmClient.getSessionInfo());
      } else if (
        payload.state === ConnectionState.Closed ||
        payload.state === ConnectionState.Fail
      ) {
        setStatus("closed");
        dispatch({ type: "reset-media" });
        if (payload.state === ConnectionState.Fail) {
          // Modal.error({
          //   title: 'Join meeting failed',
          //   content: `Join meeting failed. reason:${payload.reason ?? ''}`
          // });
        }
        if (payload.reason === "ended by host") {
          // Modal.warning({
          //   title: 'Meeting ended',
          //   content: 'This meeting has been ended by host'
          // });
        }
      }
    },
    [isFailover, zmClient]
  );
  const onMediaSDKChange = useCallback((payload: any) => {
    const { action, type, result } = payload;
    dispatch({ type: `${type}-${action}`, payload: result === "success" });
  }, []);

  const onLeaveOrJoinSession = useCallback(async () => {
    if (status === "closed") {
      setIsLoading(true);
      await zmClient.join(topic, signature, name, password);
      setIsLoading(false);
    } else if (status === "connected") {
      await zmClient.leave();
      // message.warn('You have left the session.');
    }
  }, [zmClient, status, topic, signature, name, password]);
  useEffect(() => {
    zmClient.on("connection-change", onConnectionChange);
    zmClient.on("media-sdk-change", onMediaSDKChange);
    return () => {
      zmClient.off("connection-change", onConnectionChange);
      zmClient.off("media-sdk-change", onMediaSDKChange);
    };
  }, [zmClient, onConnectionChange, onMediaSDKChange]);
  console.log({ isSupportGalleryView, galleryViewWithAttach });
  return (
    <ZoomMediaContext.Provider value={mediaContext}>
      <Router>
        <div className="relative min-h-screen">
          <Routes>
            <Route path="/" element={<HomePage loading={loading} />} />
            <Route path="/processors" element={<MediaProcessors />} />
            <Route path="/processor/:type/:id" element={<ProcessorDetail />} />
          </Routes>
        </div>
      </Router>
    </ZoomMediaContext.Provider>
  );
}

export default App;
