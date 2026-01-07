## Prerequisites

- Node.js (v14 or higher)
- FFmpeg (must be installed and available in PATH)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
node hls-stream-app.js
```

## How it works : 
This application starts a live stream with ffmpeg, hosts it, as well as a web page using the Bitmovin Player to play the stream. 
The application logs all requests in the console. 

for testing only, not meant for production
