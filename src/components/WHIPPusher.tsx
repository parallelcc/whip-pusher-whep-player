import { useState, useEffect, useRef } from 'react';
import { WHIPClient } from 'whip-whep/whip';
import { Settings, Video, Volume2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface VideoStats {
  codec?: string;
  bitrate?: number;
  frameRate?: number;
  resolution?: string;
}

interface AudioStats {
  codec?: string;
  bitrate?: number;
  level?: number;
}

interface ConnectionStats {
  dtlsState?: string;
  iceState?: string;
}

interface BytesSent {
  video: number;
  audio: number;
  timestamp: number;
}

interface Resolution {
  width?: number;
  height?: number;
  label: string;
}

interface StreamSettings {
  maxBitrate?: number;
  maxFrameRate?: number;
}

interface CodecOption {
  mimeType: string;
  label: string;
}

const RESOLUTIONS: Resolution[] = [
  { label: 'Auto' },
  { width: 3840, height: 2160, label: '4K (3840x2160)' },
  { width: 1920, height: 1080, label: '1080p (1920x1080)' },
  { width: 1280, height: 720, label: '720p (1280x720)' },
  { width: 640, height: 480, label: '480p (640x480)' },
  { width: 480, height: 360, label: '360p (480x360)' },
];

const DEFAULT_VIDEO_SETTINGS: StreamSettings = {
  maxBitrate: undefined,
  maxFrameRate: undefined,
};

const DEFAULT_AUDIO_SETTINGS: StreamSettings = {
  maxBitrate: undefined,
};

const EXCLUDED_CODEC_PATTERNS = [
  /red/i,
  /rtx/i,
  /fec/i,
  /cn/i,
  /telephone-event/i
];

function getUniqueCodecs(kind: 'video' | 'audio'): CodecOption[] {
  const capabilities = RTCRtpSender.getCapabilities(kind);
  if (!capabilities) return [];

  const uniqueCodecs = new Map<string, RTCRtpCodecCapability>();
  capabilities.codecs
    .filter(codec => !EXCLUDED_CODEC_PATTERNS.some(pattern => pattern.test(codec.mimeType)))
    .forEach(codec => {
      const baseCodec = codec.mimeType.split('/')[1].toUpperCase();
      if (!uniqueCodecs.has(baseCodec)) {
        uniqueCodecs.set(baseCodec, codec);
      }
    });

  const sortedCodecs = Array.from(uniqueCodecs.entries())
    .map(([label, codec]) => ({
      mimeType: codec.mimeType.split('/')[1].toLowerCase(),
      label
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [
    { mimeType: 'auto', label: 'Auto' },
    ...sortedCodecs
  ];
}

function WHIPPusher() {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [selectedAudio, setSelectedAudio] = useState('');
  const [selectedResolution, setSelectedResolution] = useState<Resolution>(RESOLUTIONS[0]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoStats, setVideoStats] = useState<VideoStats>({});
  const [audioStats, setAudioStats] = useState<AudioStats>({});
  const [connectionStats, setConnectionStats] = useState<ConnectionStats>({});
  const [videoCodec, setVideoCodec] = useState('auto');
  const [audioCodec, setAudioCodec] = useState('auto');
  const [error, setError] = useState<string | null>(null);
  const [videoSettings, setVideoSettings] = useState<StreamSettings>(DEFAULT_VIDEO_SETTINGS);
  const [audioSettings, setAudioSettings] = useState<StreamSettings>(DEFAULT_AUDIO_SETTINGS);
  const [videoSettingsOpen, setVideoSettingsOpen] = useState(false);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [videoCodecs, setVideoCodecs] = useState<CodecOption[]>([]);
  const [audioCodecs, setAudioCodecs] = useState<CodecOption[]>([]);

  const whipClientRef = useRef<WHIPClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastBytesSentRef = useRef<BytesSent>({ video: 0, audio: 0, timestamp: 0 });
  const statsIntervalRef = useRef<number>();

  useEffect(() => {
    setVideoCodecs(getUniqueCodecs('video'));
    setAudioCodecs(getUniqueCodecs('audio'));
  }, []);

  useEffect(() => {
    async function getDevices() {
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        
        // Only request permissions if no labeled devices are found
        if (!devices.some(device => device.label)) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          stream.getTracks().forEach(track => track.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
        }
        
        setVideoDevices(devices.filter(device => device.kind === 'videoinput'));
        setAudioDevices(devices.filter(device => device.kind === 'audioinput'));
        
        if (devices.length > 0) {
          setSelectedVideo(devices.find(d => d.kind === 'videoinput')?.deviceId || '');
          setSelectedAudio(devices.find(d => d.kind === 'audioinput')?.deviceId || '');
        }
      } catch (err) {
        setError('Failed to access media devices. Please ensure camera and microphone permissions are granted.');
      }
    }

    getDevices();
  }, []);

  const startStream = async () => {
    try {
      setError(null);

      if (!url) {
        throw new Error('Please enter a WHIP URL');
      }

      const constraints = {
        video: {
          deviceId: selectedVideo,
          ...(selectedResolution.width && selectedResolution.height ? {
            width: { ideal: selectedResolution.width },
            height: { ideal: selectedResolution.height }
          } : {}),
        },
        audio: {
          deviceId: selectedAudio,
          echoCancellation: true,
          noiseSuppression: true
        }
      };

      streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      for (const track of streamRef.current.getTracks()) {
        let codecs: RTCRtpCodecCapability[] = [];
        let sendEncodings: RTCRtpEncodingParameters[] = [];

        const capabilities = RTCRtpSender.getCapabilities(track.kind as 'video' | 'audio');
        if (capabilities) {
          if ((track.kind === 'video' && videoCodec !== 'auto') || 
              (track.kind === 'audio' && audioCodec !== 'auto')) {
            const selectedCodec = track.kind === 'video' ? videoCodec : audioCodec;
            const matchingCodecs = capabilities.codecs.filter(c => 
              c.mimeType.toLowerCase().includes(selectedCodec.toLowerCase())
            );
            if (matchingCodecs.length > 0) {
              codecs = [
                ...matchingCodecs,
                ...capabilities.codecs.filter(c => !matchingCodecs.includes(c))
              ];
            }
          }
        }

        if (track.kind === 'video') {
          if (videoSettings.maxBitrate || videoSettings.maxFrameRate) {
            sendEncodings = [{
              ...(videoSettings.maxBitrate ? { maxBitrate: videoSettings.maxBitrate * 1000 } : {}),
              ...(videoSettings.maxFrameRate ? { maxFramerate: videoSettings.maxFrameRate } : {})
            }];
          }
        } else if (track.kind === 'audio' && audioSettings.maxBitrate) {
          sendEncodings = [{ maxBitrate: audioSettings.maxBitrate * 1000 }];
        }

        const transceiver = pc.addTransceiver(track, {
          direction: 'sendonly',
          sendEncodings,
          streams: [streamRef.current]
        });

        if (codecs.length > 0) {
          await transceiver.setCodecPreferences(codecs);
        }
      }

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          setError('Connection failed. Please check your network and try again.');
          stopStream();
        }
      };

      const whipClient = new WHIPClient();
      await whipClient.publish(pc, url, token);
      whipClientRef.current = whipClient;
      setIsStreaming(true);

      statsIntervalRef.current = window.setInterval(async () => {
        if (!pcRef.current) return;

        const pc = pcRef.current;
        const stats = await pc.getStats();
        const now = Date.now();
        const interval = (now - lastBytesSentRef.current.timestamp) / 1000;
        
        stats.forEach(stat => {
          if (stat.type === 'media-source' && stat.kind === 'audio' && typeof stat.audioLevel === 'number') {
            setAudioStats(prev => ({ ...prev, level: Math.round(stat.audioLevel * 100) }));
          }
          if (stat.type === 'outbound-rtp' && stat.kind === 'video') {
            const videoBytesSent = stat.bytesSent;
            const newVideoStats: VideoStats = {};
            
            if (stat.codecId) {
              const codec = stats.get(stat.codecId);
              newVideoStats.codec = codec?.mimeType.split('/')[1].toUpperCase();
            }

            newVideoStats.bitrate = interval > 0 ? 
              Math.round(((videoBytesSent - lastBytesSentRef.current.video) * 8) / interval) : 
              0;

            newVideoStats.frameRate = stat.framesPerSecond;
            
            if (stat.frameWidth && stat.frameHeight) {
              newVideoStats.resolution = `${stat.frameWidth}x${stat.frameHeight}`;
            }

            lastBytesSentRef.current.video = videoBytesSent;
            setVideoStats(newVideoStats);
          }
          if (stat.type === 'outbound-rtp' && stat.kind === 'audio') {
            const audioBytesSent = stat.bytesSent;
            const newAudioStats: AudioStats = {};

            if (stat.codecId) {
              const codec = stats.get(stat.codecId);
              newAudioStats.codec = codec?.mimeType.split('/')[1].toUpperCase();
            }

            newAudioStats.bitrate = interval > 0 ? 
              Math.round(((audioBytesSent - lastBytesSentRef.current.audio) * 8) / interval) : 
              0;

            lastBytesSentRef.current.audio = audioBytesSent;
            setAudioStats(prev => ({ ...prev, ...newAudioStats }));
          }
        });

        lastBytesSentRef.current.timestamp = now;
        setConnectionStats({ 
          iceState: pc.iceConnectionState,
          dtlsState: pc.connectionState 
        });
      }, 1000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start stream';
      setError(errorMessage);
      await stopStream();
    }
  };

  const stopStream = async () => {
    try {
      setIsStreaming(false);
      if (statsIntervalRef.current) {
        window.clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
      setAudioStats({});
      setVideoStats({});
      lastBytesSentRef.current = { video: 0, audio: 0, timestamp: 0 };
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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (whipClientRef.current) {
        await whipClientRef.current.stop();
        whipClientRef.current = null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop stream';
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
            <label className="block text-sm font-medium text-gray-700 mb-2">WHIP URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="https://example.com/whip"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Video className="h-4 w-4" /> Video Device
            </label>
            <select
              value={selectedVideo}
              onChange={(e) => setSelectedVideo(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={isStreaming}
            >
              {videoDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Video Device ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Volume2 className="h-4 w-4" /> Audio Device
            </label>
            <select
              value={selectedAudio}
              onChange={(e) => setSelectedAudio(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              disabled={isStreaming}
            >
              {audioDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Audio Device ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <button
                onClick={() => setVideoSettingsOpen(!videoSettingsOpen)}
                className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2 bg-gray-50 p-2 rounded-md hover:bg-gray-100"
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Video Settings
                </span>
                {videoSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {videoSettingsOpen && (
                <div className="space-y-4 border rounded-md p-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Codec</label>
                    <select
                      value={videoCodec}
                      onChange={(e) => setVideoCodec(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={isStreaming}
                    >
                      {videoCodecs.map(codec => (
                        <option key={codec.mimeType} value={codec.mimeType}>
                          {codec.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Resolution</label>
                    <select
                      value={selectedResolution.width ? `${selectedResolution.width}x${selectedResolution.height}` : 'auto'}
                      onChange={(e) => {
                        if (e.target.value === 'auto') {
                          setSelectedResolution(RESOLUTIONS[0]);
                        } else {
                          const [width, height] = e.target.value.split('x').map(Number);
                          setSelectedResolution(RESOLUTIONS.find(r => r.width === width && r.height === height) || RESOLUTIONS[0]);
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={isStreaming}
                    >
                      {RESOLUTIONS.map(res => (
                        <option 
                          key={res.width ? `${res.width}x${res.height}` : 'auto'} 
                          value={res.width ? `${res.width}x${res.height}` : 'auto'}
                        >
                          {res.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Max Bitrate (kbps)</label>
                    <input
                      type="number"
                      value={videoSettings.maxBitrate || ''}
                      onChange={(e) => setVideoSettings(prev => ({ ...prev, maxBitrate: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full px-3 py-2 border rounded-md"
                      min="100"
                      max="10000"
                      step="100"
                      placeholder="Auto"
                      disabled={isStreaming}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Max Frame Rate</label>
                    <input
                      type="number"
                      value={videoSettings.maxFrameRate || ''}
                      onChange={(e) => setVideoSettings(prev => ({ ...prev, maxFrameRate: e.target.value ? Number(e.target.value) : undefined }))}
                      className="w-full px-3 py-2 border rounded-md"
                      min="1"
                      max="60"
                      placeholder="Auto"
                      disabled={isStreaming}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div>
            <button
              onClick={() => setAudioSettingsOpen(!audioSettingsOpen)}
              className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2 bg-gray-50 p-2 rounded-md hover:bg-gray-100"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Audio Settings
              </span>
              {audioSettingsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {audioSettingsOpen && (
              <div className="space-y-4 border rounded-md p-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Codec</label>
                  <select
                    value={audioCodec}
                    onChange={(e) => setAudioCodec(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    disabled={isStreaming}
                  >
                    {audioCodecs.map(codec => (
                      <option key={codec.mimeType} value={codec.mimeType}>
                        {codec.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Max Bitrate (kbps)</label>
                  <input
                    type="number"
                    value={audioSettings.maxBitrate || ''}
                    onChange={(e) => setAudioSettings(prev => ({ ...prev, maxBitrate: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-3 py-2 border rounded-md"
                    min="8"
                    max="510"
                    step="1"
                    placeholder="Auto"
                    disabled={isStreaming}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={isStreaming ? stopStream : startStream}
            className={`px-6 py-2 rounded-md text-white font-medium ${
              isStreaming 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
          </button>
        </div>

        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
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
                <div className="bg-white p-3 rounded shadow">
                  <div className="text-sm text-gray-600">Level</div>
                  <div className="font-medium">{audioStats.level != undefined ? `${audioStats.level}%` : 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WHIPPusher;