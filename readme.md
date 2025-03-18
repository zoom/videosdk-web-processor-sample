# Zoom Media Processor Sample

## Installation

To get started, clone the repo:

`$ git clone https://github.com/zoom/zoom-videosdk-web-processor-sample.git`

## Setup

1. Once cloned, navigate to the `sample` directory:

   `$ cd sample`

1. Then install the dependencies:

   `$ npm install`

1. Open the directory in your code editor.

1. Open the `src/config/dev.ts` file and enter required session values for the variables:

   | Key         | Value Description                                                                           |
   | ----------- | ------------------------------------------------------------------------------------------- |
   | `sdkKey`    | Your Video SDK Key. Required.                                                               |
   | `sdkSecret` | Your Video SDK Secret. Required.                                                            |
   | `topic`     | Required, a session name of your choice or the name of the session you are joining.         |
   | `name`      | Required, a name for the participant.                                                       |
   | `password`  | Optional, a session passcode of your choice or the passcode of the session you are joining. |

   Example:

   ```js
   {
     // ...
     sdkKey: 'YOUR_VIDEO_SDK_KEY',
     sdkSecret: 'YOUR_VIDEO_SDK_SECRET',
     topic: 'Cool Cars',
     name: 'user123',
     password: 'abc123'
     // ...
   }
   ```

   > Reminder to not publish this sample app as is. Replace the Video SDK JWT generator with a [backend Video SDK JWT generator](https://developers.zoom.us/docs/video-sdk/auth/#generate-a-video-sdk-jwt) to keep your SDK Secret safe.

1. Save `dev.ts`.

1. Run the app:

   `$ npm run dev`

## Usage

1. Navigate to http://localhost:3000 and click Media Processor.

2. Start video and select a processor, enjoy it.

   > We have two test processors now, the source code is in the lib folder and need to build and put it into a public server, you can see the bulit files on public folder.
