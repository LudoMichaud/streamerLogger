const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const HLS_DIR = path.join(__dirname, 'hls');

// Create HLS directory if it doesn't exist
if (!fs.existsSync(HLS_DIR)) {
    fs.mkdirSync(HLS_DIR, { recursive: true });
}

// Middleware to log all requests with headers
app.use((req, res, next) => {
    console.log('\n========== NEW REQUEST ==========');
    console.log(`[${new Date().toISOString()}]`);
    console.log(`Method: ${req.method}`);
    console.log(`URL: ${req.url}`);
    console.log(`IP: ${req.ip}`);
    console.log('\nHeaders:');
    Object.entries(req.headers).forEach(([key, value]) => {
console.log(key === 'x-test' ? `  \x1b[42m\x1b[30m${key}: ${value}\x1b[0m` : `  ${key}: ${value}`);
    });
    console.log('=================================\n');
    next();
});

// Add CORS headers for HLS streaming
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve HLS files - handle both with and without query parameters
app.get('/hls/:file', (req, res) => {
    const fileName = req.params.file;
    const filePath = path.join(HLS_DIR, fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.log(`❌ File not found: ${fileName}`);
        return res.status(404).send('File not found');
    }
    
    // Set appropriate content type
    if (fileName.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (fileName.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/MP2T');
    }
    
    // Disable caching for live streams
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Send the file
    res.sendFile(filePath);
});

// Root endpoint
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<!--
*
* Copyright (C) 2020, bitmovin GmbH, All Rights Reserved
*
* This source code and its use and distribution, is subject to the terms
* and conditions of the applicable license agreement.
*
-->
<html lang="en">

<head>
    <title>Bitmovin Player Demo</title>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- Bitmovin Player -->
    <script type="text/javascript" src="https://cdn.bitmovin.com/player/web/8/bitmovinplayer.js"></script>
    <script type="text/javascript" src="https://cdn.bitmovin.com/player/web/8/modules/bitmovinplayer-serviceworker-client.js"></script>

    <style>
        .container {
            color: white;
            text-align: center;
        }
        
        .container a {
            color: white;
        }
        
        .container h1 {
            margin-bottom: 22px;
            line-height: 66px;
        }
        
        .container h2 {
            font-weight: normal;
            margin-bottom: 36px;
            line-height: 26px;
        }
        
        .player-wrapper {
            width: 95%;
            margin: 20px auto;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="content">
            <div class="player-wrapper">
                <div id="player"></div>
            </div>
        </div>
    </div>
    <script type="text/javascript">
        // Network Request Monitor
        (function() {
            const requests = [];

            // Override XHR
            const XHROpen = XMLHttpRequest.prototype.open;
            const XHRSend = XMLHttpRequest.prototype.send;
            const XHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;

            XMLHttpRequest.prototype.open = function(method, url) {
                this._requestData = {
                    method,
                    url,
                    headers: {},
                    timestamp: Date.now()
                };
                return XHROpen.apply(this, arguments);
            };

            XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
                if (this._requestData) {
                    this._requestData.headers[header] = value;
                }
                return XHRSetHeader.apply(this, arguments);
            };

            XMLHttpRequest.prototype.send = function(body) {
                if (this._requestData) {
                    this._requestData.body = body;
                    requests.push({...this._requestData,
                        type: 'XHR'
                    });
                    console.table([this._requestData]);
                }
                return XHRSend.apply(this, arguments);
            };

            // Override Fetch
            const originalFetch = window.fetch;
            window.fetch = function(url, options = {}) {
                const requestData = {
                    type: 'Fetch',
                    method: options.method || 'GET',
                    url: typeof url === 'string' ? url : url.url,
                    headers: options.headers || {},
                    timestamp: Date.now()
                };

                requests.push(requestData);
                console.table([requestData]);

                return originalFetch.apply(this, arguments);
            };

            // Expose for inspection
            window.getNetworkRequests = () => requests;
            window.clearNetworkRequests = () => requests.length = 0;
        })();



        function unregisterAllServiceWorker() {
            return navigator.serviceWorker.getRegistrations().then((registrations) => {
                return Promise
                    .all(registrations.map(registration => registration.unregister()))
                    .then(() => {});
            });
        }



        const conf = {
            key: "YOUR_KEY_HERE",
            location: {
                //serviceworker: './sw.js?t=' + Date.now()
            },
            tweaks: {
                native_hls_parsing: true,
                fairplay_ignore_duplicate_init_data_key_errors: true,
            },
        location: {
                serviceworker: 'https://cdn.jsdelivr.net/npm/bitmovin-player@8.241.0/bitmovinplayer-serviceworker.js?t=' + Date.now()
            },
            network: {
                preprocessHttpResponse: function(requestType, response) {
                    if (requestType === "manifest/hls/master") {
                        console.log(response.body)
                            //return response
                    }
                },

                preprocessHttpRequest(requestType, request) {
                    request.headers["X-Test"] = "test123";
                    if (requestType === "manifest/hls/variant") {
                        console.log('[preprocessHttpRequest] CALLED');
                        console.log('[preprocessHttpRequest] Type:', requestType);
                        console.log('[preprocessHttpRequest] URL:', request.url);
                        request.headers["X-Test"] = "test123";
                        return request
                    }
                }
            }
        };

        const source = {
            "hls": "http://localhost:3000/hls/master.m3u8"
        };

        bitmovin.player.Player.addModule(bitmovin.player['serviceworker-client'].default);

        var player;
        unregisterAllServiceWorker().then(() => {
            player = new bitmovin.player.Player(document.getElementById('player'), conf);

            player.load(source).then(() => player.play());
        });
    </script>
</body>

</html>
    `);
});

// Start FFmpeg process to generate HLS stream
function startFFmpegStream() {
    console.log('\n🎬 Starting FFmpeg HLS stream generation...\n');
    
    // Clean up old HLS files on startup
    if (fs.existsSync(HLS_DIR)) {
        const files = fs.readdirSync(HLS_DIR);
        files.forEach(file => {
            try {
                fs.unlinkSync(path.join(HLS_DIR, file));
            } catch (e) {
                // Ignore errors
            }
        });
    }
    
    // Generate a test pattern with timestamp overlay
const ffmpeg = spawn('ffmpeg', [
    '-re',
    '-f', 'lavfi',
    '-i', 'testsrc=size=1280x720:rate=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=1000:sample_rate=48000',
    '-filter_complex', "[0:v]drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='Live Stream %{localtime\\:%T}':x=(w-text_w)/2:y=h-th-10:fontsize=48:fontcolor=white:box=1:boxcolor=black@0.5,split=2[v1][v2];[v2]scale=640x360[v2out]",
    '-map', '[v1]',
    '-map', '[v2out]',
    '-map', '1:a',
    '-map', '1:a',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-g', '60',
    '-sc_threshold', '0',
    '-b:v:0', '2500k',
    '-maxrate:v:0', '2500k',
    '-bufsize:v:0', '5000k',
    '-b:v:1', '1000k',
    '-maxrate:v:1', '1000k',
    '-bufsize:v:1', '2000k',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '10',
    '-hls_flags', 'delete_segments+independent_segments',
    '-hls_allow_cache', '0',
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', 'v:0,a:0 v:1,a:1',
    '-hls_segment_filename', path.join(HLS_DIR, 'stream_%v_segment%03d.ts'),
    path.join(HLS_DIR, 'stream_%v.m3u8')
]);

    ffmpeg.stdout.on('data', (data) => {
        console.log(`[FFmpeg stdout]: ${data}`);
    });

    ffmpeg.stderr.on('data', (data) => {
        // FFmpeg outputs to stderr by default
        const output = data.toString();
        if (output.includes('frame=') || output.includes('time=')) {
            process.stdout.write(`\r[FFmpeg]: ${output.trim()}`);
        }
    });

    ffmpeg.on('error', (error) => {
        console.error(`\n❌ FFmpeg error: ${error.message}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`\n\n⚠️  FFmpeg process exited with code ${code}`);
        if (code !== 0) {
            console.log('Restarting FFmpeg in 3 seconds...');
            setTimeout(startFFmpegStream, 3000);
        }
    });

    return ffmpeg;
}

// Start the server
const server = app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('🚀 HLS Stream Server Started!');
    console.log('========================================');
    console.log(`\n📺 Stream URL: http://localhost:${PORT}/hls/master.m3u8`);
    console.log(`🌐 Web Player: http://localhost:${PORT}/`);
    console.log(`📁 HLS Files: ${HLS_DIR}`);
    console.log('\n========================================\n');
    
    // Start FFmpeg stream generation
    const ffmpegProcess = startFFmpegStream();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutting down...');
        ffmpegProcess.kill('SIGTERM');
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });
});
