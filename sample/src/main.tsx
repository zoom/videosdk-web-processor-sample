import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ZoomVideo from '@zoom/videosdk';
import { b64DecodeUnicode, generateVideoToken } from './utils/util';
import App from './App';
import { devConfig } from './config/dev';
import ZoomContext from './context/zoom-context';
import './index.css';
import { loadConfigFromStorage } from './utils/sessionConfig';

let meetingArgs: any = Object.fromEntries(new URLSearchParams(location.search));
// Add enforceGalleryView to turn on the gallery view without SharedAddayBuffer
if (!meetingArgs.sdkKey || !meetingArgs.topic || !meetingArgs.name || !meetingArgs.signature) {
  meetingArgs = { ...devConfig, ...meetingArgs };
}

if (meetingArgs.web && meetingArgs.web !== '0') {
  ['topic', 'name', 'password', 'sessionKey', 'userIdentity'].forEach((field) => {
    if (Object.hasOwn(meetingArgs, field)) {
      try {
        meetingArgs[field] = b64DecodeUnicode(meetingArgs[field]);
      } catch (e) {
        console.log('ignore base64 decode', field, meetingArgs[field]);
      }
    }
  });
  if (meetingArgs.role) {
    meetingArgs.role = parseInt(meetingArgs.role, 10);
  } else {
    meetingArgs.role = 1;
  }
}
// enforce use <video> tag render video, https://marketplacefront.zoom.us/sdk/custom/web/modules/Stream.html#attachVideo
meetingArgs.useVideoPlayer = 1;

['enforceGalleryView', 'enforceVB', 'cloud_recording_option', 'cloud_recording_election'].forEach((field) => {
  if (Object.hasOwn(meetingArgs, field)) {
    try {
      meetingArgs[field] = Number(meetingArgs[field]);
    } catch (e) {
      meetingArgs[field] = 0;
    }
  }
});
if (meetingArgs?.telemetry_tracking_id) {
  try {
    meetingArgs.telemetry_tracking_id = b64DecodeUnicode(meetingArgs.telemetry_tracking_id);
  } catch (e) {}
} else {
  meetingArgs.telemetry_tracking_id = '';
}

if (!meetingArgs.signature && meetingArgs.sdkSecret && meetingArgs.topic) {
  meetingArgs.signature = generateVideoToken(
    meetingArgs.sdkKey,
    meetingArgs.sdkSecret,
    meetingArgs.topic,
    meetingArgs.sessionKey,
    meetingArgs.userIdentity,
    Number(meetingArgs.role ?? 1),
    meetingArgs.cloud_recording_option,
    meetingArgs.cloud_recording_election,
    meetingArgs.telemetry_tracking_id,
    loadConfigFromStorage().webRTCVideo === 'true' ? 1 : 0,
    loadConfigFromStorage().webRTCAudio === 'true' ? 1 : 0
  );
  console.log('=====================================');
  console.log('meetingArgs', meetingArgs);

  const urlArgs: any = {
    topic: meetingArgs.topic,
    name: meetingArgs.name,
    password: meetingArgs.password,
    sessionKey: meetingArgs.sessionKey,
    userIdentity: meetingArgs.userIdentity,
    role: meetingArgs.role || 1,
    cloud_recording_option: meetingArgs.cloud_recording_option || '',
    cloud_recording_election: meetingArgs.cloud_recording_election || '',
    telemetry_tracking_id: meetingArgs.telemetry_tracking_id || '',
    enforceGalleryView: 0,
    enforceVB: 0,
    web: '1'
  };
  console.log('use url args');
  console.log(window.location.origin + '/?' + new URLSearchParams(urlArgs).toString());
}
const zmClient = ZoomVideo.createClient();

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <ZoomContext.Provider value={zmClient}>
      <App meetingArgs={meetingArgs as any} />
    </ZoomContext.Provider>
  // </StrictMode>
);
