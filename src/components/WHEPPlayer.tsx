import { useState, useRef } from 'react';
import { WHEPClient } from 'whip-whep/whep';
import { AlertCircle } from 'lucide-react';

interface VideoStats {
  codec?: string;
  bitrate?: number;
  frameRate?: number;
  resolution?: string;
}

interface AudioStats {
  codec?: string;
  bitrate?: number;
}

interface ConnectionStats {
  dtlsState?: string;
  iceState?: string;
}

interface BytesReceived {
  video: number;
  audio: number;
  timestamp: number;
}

function WHEPPlayer() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoStats, setVideoStats] = useState<VideoStats>({});
  const [audioStats, setAudioStats] = useState<AudioStats>({});
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({});
  const [error, setError] = useState<string | null>(null);

  const whepClientRef = useRef<WHEPClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastBytesReceivedRef = useRef<BytesReceived>({ video: 0, audio: 0, timestamp: 0 });
  const statsIntervalRef = useRef<number>();

  const startPlaying = async () => {
    try {
      setError(null);

      if (!url) {
        throw new Error('Please enter a WHEP URL');
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.addTransceiver('video', { direction: 'recvonly' });

      pc.ontrack = (event) => {
        if (videoRef.current) {
          if (videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).addTrack(event.track);
          } else {
            const stream = new MediaStream([event.track]);
            videoRef.current.srcObject = stream;
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          setError('Connection failed. Please check your network and try again.');
          stopPlaying();
        }
      };

      const whepClient = new WHEPClient();
      await whepClient.view(pc, url, token);
      whepClientRef.current = whepClient;
      setIsPlaying(true);

      statsIntervalRef.current = window.setInterval(async () => {
        if (!pcRef.current) return;

        const pc = pcRef.current;
        const stats = await pc.getStats();
        const now = Date.now();
        const interval = (now - lastBytesReceivedRef.current.timestamp) / 1000;
        
        stats.forEach(stat => {
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            const videoBytesReceived = stat.bytesReceived;
            const newVideoStats: VideoStats = {};
            
            if (stat.codecId) {
              const codec = stats.get(stat.codecId);
              newVideoStats.codec = codec?.mimeType.split('/')[1].toUpperCase();
            }
            
            newVideoStats.bitrate = interval > 0 ? 
              Math.round(((videoBytesReceived - lastBytesReceivedRef.current.video) * 8) / interval) : 
              0;
            
            newVideoStats.frameRate = stat.framesPerSecond;
            
            if (stat.frameWidth && stat.frameHeight) {
              newVideoStats.resolution = `${stat.frameWidth}x${stat.frameHeight}`;
            }
            
            lastBytesReceivedRef.current.video = videoBytesReceived;
            setVideoStats(newVideoStats);
          }
          if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
            const audioBytesReceived = stat.bytesReceived;
            const newAudioStats: AudioStats = {};
            
            if (stat.codecId) {
              const codec = stats.get(stat.codecId);
              newAudioStats.codec = codec?.mimeType.split('/')[1].toUpperCase();
            }
            
            newAudioStats.bitrate = interval > 0 ? 
              Math.round(((audioBytesReceived - lastBytesReceivedRef.current.audio) * 8) / interval) : 
              0;
            
            lastBytesReceivedRef.current.audio = audioBytesReceived;
            setAudioStats(newAudioStats);
          }
        });

        lastBytesReceivedRef.current.timestamp = now;
        setConnectionStats({ 
          iceState: pc.iceConnectionState,
          dtlsState: pc.connectionState 
        });
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start playback';
      setError(errorMessage);
      await stopPlaying();
    }
  };

  const stopPlaying = async () => {
    try {
      setIsPlaying(false);
      if (statsIntervalRef.current) {
        window.clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
      setAudioStats({});
      setVideoStats({});
      lastBytesReceivedRef.current = { video: 0, audio: 0, timestamp: 0 };
      const pc = pcRef.current;
      if (pc) {
        if (pc.iceConnectionState === 'failed') {
          setConnectionStats({ 
            iceState: pc.iceConnectionState,
            dtlsState: pc.connectionState 
          });
        } else {
          setConnectionStats({ 
            iceState: 'closed',
            dtlsState: 'closed' 
          });
        }
        pc.close();
        pcRef.current = null;
      }
      if (videoRef.current) {
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        videoRef.current.srcObject = null;
      }
      if (whepClientRef.current) {
        await whepClientRef.current.stop();
        whepClientRef.current = null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop playback';
      setError(errorMessage);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">WHEP URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="https://example.com/whep"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bearer Token (Optional)</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Bearer token"
            />
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={isPlaying ? stopPlaying : startPlaying}
            className={`px-6 py-2 rounded-md text-white font-medium ${
              isPlaying 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPlaying ? 'Stop Playing' : 'Start Playing'}
          </button>
        </div>

        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Stream Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-4">
              <h3 className="font-medium text-gray-700">Connection</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="bg-white p-3 rounded shadow">
                  <div className="text-sm text-gray-600">ICE Status</div>
                  <div className="font-medium">{connectionStats.iceState || 'N/A'}</div>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <div className="text-sm text-gray-600">DTLS Status</div>
                  <div className="font-medium">{connectionStats.dtlsState || 'N/A'}</div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-medium text-gray-700">Video</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="bg-white p-3 rounded shadow">
                  <div className="text-sm text-gray-600">Codec</div>
                  <div className="font-medium">{videoStats.codec || 'N/A'}</div>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <div className="text-sm text-gray-600">Bitrate</div>
                  <div className="font-medium">{videoStats.bitrate != undefined ? `${Math.round(videoStats.bitrate / 1000)} kbps` : 'N/A'}</div>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <div className="text-sm text-gray-600">Frame Rate</div>
                  <div className="font-medium">{videoStats.frameRate != undefined ? `${videoStats.frameRate} FPS` : 'N/A'}</div>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <div className="text-sm text-gray-600">Resolution</div>
                  <div className="font-medium">{videoStats.resolution || 'N/A'}</div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-medium text-gray-700">Audio</h3>
              <div className="grid grid-cols-1 gap-2">
                <div className="bg-white p-3 rounded shadow">
                  <div className="text-sm text-gray-600">Codec</div>
                  <div className="font-medium">{audioStats.codec || 'N/A'}</div>
                </div>
                <div className="bg-white p-3 rounded shadow">
                  <div className="text-sm text-gray-600">Bitrate</div>
                  <div className="font-medium">{audioStats.bitrate != undefined ? `${Math.round(audioStats.bitrate / 1000)} kbps` : 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WHEPPlayer;