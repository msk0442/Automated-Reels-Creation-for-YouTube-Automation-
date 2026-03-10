import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VideoPlan, Scene, Caption } from '../types';
import { Play, Pause, RotateCcw, Download } from 'lucide-react';

interface ResultsDisplayProps {
  videoPlan: VideoPlan;
  images: string[] | null;
  audioData: string | null;
}

// Helper to decode base64 string to Uint8Array
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Custom audio decoder for raw PCM data.
 * The Web Audio API's `ctx.decodeAudioData` is designed for file formats like MP3/WAV,
 * not raw audio streams. This function manually constructs an AudioBuffer from the
 * raw 16-bit PCM data returned by the Gemini TTS API.
 * @param data Raw audio data as a Uint8Array.
 * @param ctx The AudioContext.
 * @param sampleRate The sample rate of the audio (24000 for Gemini TTS).
 * @param numChannels Number of audio channels (1 for mono).
 * @returns A promise that resolves to an AudioBuffer.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Easing function for smooth animations
const easeInOutQuad = (t: number): number => {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
};

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ videoPlan, images, audioData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [adjustedPlan, setAdjustedPlan] = useState<VideoPlan | null>(null);

  const loadedImages = useRef<(HTMLImageElement | null)[]>([]);
  const animationFrameId = useRef<number | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioStartTime = useRef<number>(0);
  const pausedAtTime = useRef<number>(0);

  const totalDuration = adjustedPlan ? adjustedPlan.scenes.reduce((acc, scene) => acc + scene.duration, 0) : 0;

  // Load assets, and synchronize timings
  useEffect(() => {
    if (images && audioData && !isReady) {
      const loadAssetsAndSync = async () => {
        try {
          // Load images
          const imagePromises = images.map(base64 =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new window.Image();
              img.src = `data:image/jpeg;base64,${base64}`;
              img.onload = () => resolve(img);
              img.onerror = reject;
            })
          );

          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          }
          const ctx = audioContextRef.current;
          const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
          audioBufferRef.current = buffer;

          // --- NEW: Synchronization Logic ---
          // The AI's script timing is an estimate. The actual voiceover duration is the source of truth.
          // We scale all scene and caption timings to perfectly match the real audio length.
          const actualAudioDuration = buffer.duration;
          const plannedDuration = videoPlan.captions[videoPlan.captions.length - 1]?.end || videoPlan.scenes.reduce((acc, s) => acc + s.duration, 0);

          let finalPlan = videoPlan;
          if (plannedDuration > 0 && actualAudioDuration > 0) {
            const scaleFactor = actualAudioDuration / plannedDuration;
            const newScenes = videoPlan.scenes.map(scene => ({
              ...scene,
              duration: scene.duration * scaleFactor,
            }));
            const newCaptions = videoPlan.captions.map(caption => ({
              ...caption,
              start: caption.start * scaleFactor,
              end: caption.end * scaleFactor,
            }));
            finalPlan = {
              ...videoPlan,
              scenes: newScenes,
              captions: newCaptions,
            };
          }
          setAdjustedPlan(finalPlan);
          // --- END: Synchronization Logic ---

          const loadedImageElements = await Promise.all(imagePromises);
          loadedImages.current = loadedImageElements;

          setIsReady(true);
        } catch (error) {
          console.error("Failed to load assets:", error);
          setRecordingStatus('Error: Failed to load assets.');
        }
      };
      loadAssetsAndSync();
    }
  }, [images, audioData, isReady, videoPlan]);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !adjustedPlan) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let sceneStartTime = 0;
    let currentScene: Scene | null = null;
    let currentSceneIndex = -1;

    for (let i = 0; i < adjustedPlan.scenes.length; i++) {
      const scene = adjustedPlan.scenes[i];
      if (time >= sceneStartTime && time < sceneStartTime + scene.duration) {
        currentScene = scene;
        currentSceneIndex = i;
        break;
      }
      sceneStartTime += scene.duration;
    }

    if (currentScene && currentSceneIndex !== -1) {
      const img = loadedImages.current[currentSceneIndex];
      if (img && img.complete) {
        const sceneProgress = (time - sceneStartTime) / currentScene.duration;
        const easedProgress = easeInOutQuad(sceneProgress);

        const scale = currentScene.animation === 'zoom-in' ? 1 + easedProgress * 0.1 :
          currentScene.animation === 'zoom-out' ? 1.1 - easedProgress * 0.1 : 1.1;

        let dx = 0, dy = 0;
        const panRange = 0.05;
        if (currentScene.animation === 'pan-right') dx = -easedProgress * panRange;
        if (currentScene.animation === 'pan-left') dx = easedProgress * panRange;

        const imgAspectRatio = img.width / img.height;
        const canvasAspectRatio = canvas.width / canvas.height;

        let sw, sh, sx, sy;
        if (imgAspectRatio > canvasAspectRatio) {
          sh = img.height;
          sw = sh * canvasAspectRatio;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          sw = img.width;
          sh = sw / canvasAspectRatio;
          sx = 0;
          sy = (img.height - sh) / 2;
        }

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(scale, scale);
        ctx.translate(dx * canvas.width, dy * canvas.height);
        ctx.drawImage(img, sx, sy, sw, sh, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();
      }
    }

    const activeCaption = adjustedPlan.captions.find(c => time >= c.start && time <= c.end);
    if (activeCaption) {
      const fontSize = canvas.width * 0.06; // Responsive font size
      ctx.font = `bold ${fontSize}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'center';
      const words = activeCaption.text.split(' ');
      let line = '';
      const lines = [];
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > canvas.width * 0.9 && n > 0) {
          lines.push(line);
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line);

      const lineHeight = fontSize * 1.3;
      const startY = canvas.height - (lines.length * lineHeight) - (canvas.height * 0.05);
      const padding = fontSize * 0.3;

      lines.forEach((l, i) => {
        const yPos = startY + i * lineHeight;
        const lineWidth = ctx.measureText(l).width;
        // Draw semi-transparent background for captions
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect((canvas.width - lineWidth) / 2 - padding, yPos - (fontSize * 0.9), lineWidth + padding * 2, lineHeight);

        // --- Enhanced Caption Style for Readability ---
        // Draw a stroke around the text to make it stand out against any background
        ctx.strokeStyle = 'black';
        ctx.lineWidth = fontSize * 0.1; // 10% of font size for a subtle but effective stroke
        ctx.lineJoin = 'round'; // For smoother corners on text characters
        ctx.strokeText(l, canvas.width / 2, yPos);

        // Draw the main text fill
        ctx.fillStyle = 'white';
        ctx.fillText(l, canvas.width / 2, yPos);
      });
    }
  }, [adjustedPlan]);

  const renderLoop = useCallback(() => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx || !isPlaying) return;

    const elapsed = audioCtx.currentTime - audioStartTime.current;
    const time = Math.min(elapsed, totalDuration);
    setCurrentTime(time);
    draw(time);

    if (time < totalDuration) {
      animationFrameId.current = requestAnimationFrame(renderLoop);
    } else {
      // Ensure the audio end event fires cleanly
      if (isPlaying) {
        setIsPlaying(false);
        pausedAtTime.current = totalDuration;
      }
    }
  }, [isPlaying, totalDuration, draw]);

  useEffect(() => {
    if (audioSourceNodeRef.current) {
      audioSourceNodeRef.current.onended = () => {
        if (isPlaying) { // Only if it ended naturally, not from being stopped
          setIsPlaying(false);
          pausedAtTime.current = totalDuration;
          setCurrentTime(totalDuration);
          if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        }
      };
    }
  }, [isPlaying, totalDuration]);

  const handlePlay = () => {
    if (!isReady || isPlaying) return;
    const audioCtx = audioContextRef.current;
    if (!audioCtx || !audioBufferRef.current) return;

    if (audioCtx.state === 'suspended') audioCtx.resume();

    const source = audioCtx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.connect(audioCtx.destination);

    if (pausedAtTime.current >= totalDuration) pausedAtTime.current = 0;

    source.start(0, pausedAtTime.current);
    audioSourceNodeRef.current = source;
    audioStartTime.current = audioCtx.currentTime - pausedAtTime.current;

    setIsPlaying(true);
    animationFrameId.current = requestAnimationFrame(renderLoop);
  };

  const handlePause = () => {
    if (!isPlaying) return;
    const audioCtx = audioContextRef.current;
    const source = audioSourceNodeRef.current;

    if (audioCtx && source) {
      pausedAtTime.current = audioCtx.currentTime - audioStartTime.current;
      source.stop();
      audioSourceNodeRef.current = null;
    }

    setIsPlaying(false);
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  };

  const handleRestart = () => {
    if (!isReady) return;
    if (isPlaying) {
      handlePause();
    }
    pausedAtTime.current = 0;
    setCurrentTime(0);
    draw(0);
    // Use a short timeout to ensure state updates from handlePause propagate before playing.
    setTimeout(() => handlePlay(), 100);
  };

  const handleDownload = async () => {
    if (isRecording || !isReady || !audioData) return;

    setIsRecording(true);
    setRecordingStatus('Preparing for 1080p recording...');

    const canvas = canvasRef.current;
    if (!canvas) {
      setIsRecording(false);
      setRecordingStatus('Error: Canvas not found.');
      return;
    }

    if (isPlaying) handlePause();

    try {
      const stream = canvas.captureStream(60); // Capture at 60fps for smoothness

      // --- FIX for audio speed/pitch issue ---
      // 1. Create an AudioContext at the browser's native sample rate for maximum compatibility
      //    with MediaRecorder.
      const recordAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const targetSampleRate = recordAudioCtx.sampleRate;
      const originalSampleRate = 24000; // Gemini TTS sample rate

      // 2. Decode the original audio data at its native 24kHz sample rate.
      const originalBuffer = await decodeAudioData(decode(audioData), recordAudioCtx, originalSampleRate, 1);

      // 3. Resample the audio to the target sample rate if they don't match. This is the crucial
      //    step to prevent the "chipmunk effect" (fast audio with high pitch).
      let finalBuffer = originalBuffer;
      if (originalSampleRate !== targetSampleRate) {
        setRecordingStatus('Resampling audio for compatibility...');
        const newLength = Math.round(originalBuffer.length * targetSampleRate / originalSampleRate);
        const offlineCtx = new OfflineAudioContext(originalBuffer.numberOfChannels, newLength, targetSampleRate);

        const source = offlineCtx.createBufferSource();
        source.buffer = originalBuffer;
        source.connect(offlineCtx.destination);
        source.start(0);

        finalBuffer = await offlineCtx.startRendering();
      }

      // 4. Create a MediaStream from the final, correctly-sampled audio buffer.
      const audioDestination = recordAudioCtx.createMediaStreamDestination();
      const audioSource = recordAudioCtx.createBufferSource();
      audioSource.buffer = finalBuffer; // Use the resampled buffer
      audioSource.connect(audioDestination);

      // Add the audio track to the canvas stream to create a combined video+audio stream.
      const audioTrack = audioDestination.stream.getAudioTracks()[0];
      stream.addTrack(audioTrack);
      // --- End of fix ---

      const chunks: Blob[] = [];

      // --- MimeType and Codec Selection for Maximum Compatibility ---
      // Prioritize MP4 with H.264 (avc1) as it's universally supported by social media.
      // Try Main Profile for better quality, fall back to Baseline, then to WebM.
      const mp4H264Main = 'video/mp4; codecs=avc1.4D401F';
      const mp4H264Baseline = 'video/mp4; codecs=avc1.42E01E';
      let mimeType = 'video/webm'; // Default fallback

      if (MediaRecorder.isTypeSupported(mp4H264Main)) {
        mimeType = mp4H264Main;
      } else if (MediaRecorder.isTypeSupported(mp4H264Baseline)) {
        mimeType = mp4H264Baseline;
      }

      const fileExtension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';

      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 10000000 // 10 Mbps bitrate, good for high-quality 1080p
      });

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reelcraft-1080p-video.${fileExtension}`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
        setRecordingStatus('');
        // Reset player to initial state
        setCurrentTime(0);
        draw(0);
      };

      recorder.start();
      audioSource.start();
      setRecordingStatus(`Recording... Rendering 1080p video. This will take approximately ${Math.round(totalDuration)} seconds.`);

      // --- NEW REAL-TIME RENDERING LOGIC ---
      // We now use the AudioContext's own clock as the master timeline. This ensures the
      // video frames are rendered in perfect sync with the audio track being recorded.
      const renderFrameForRecording = () => {
        // Use the audio context's current time as the ground truth for animation.
        const time = Math.min(recordAudioCtx.currentTime, totalDuration);

        draw(time);
        setRecordingStatus(`Rendering 1080p... ${Math.round((time / totalDuration) * 100)}%`);

        // Continue rendering as long as we're within the video's duration and the recorder is active.
        if (time < totalDuration && recorder.state === 'recording') {
          requestAnimationFrame(renderFrameForRecording);
        } else {
          // Once the animation time exceeds the duration, stop the recorder.
          if (recorder.state === 'recording') {
            // A small delay to ensure the last frame and audio snippet are processed.
            setTimeout(() => {
              recorder.stop();
              setRecordingStatus('Finalizing your 1080p video...');
            }, 100);
          }
        }
      };

      requestAnimationFrame(renderFrameForRecording);

    } catch (error) {
      console.error("Recording failed:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setRecordingStatus(`Error: ${errorMessage}`);
      setIsRecording(false);
    }
  };

  // Draw initial frame
  useEffect(() => {
    if (isReady) {
      draw(0);
    }
  }, [isReady, draw]);

  return (
    <div className="glass-card">
      <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.8rem', fontWeight: 700 }}>Masterpiece Ready 🎬</h2>

      <div className="video-container">
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          className="video-canvas"
        />
        {!isReady && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }}>
            <p style={{ color: 'var(--accent-3)', fontWeight: 600, animation: 'pulseGlow 2s infinite' }}>Synchronizing Engine...</p>
          </div>
        )}
      </div>

      <div style={{ maxWidth: '360px', margin: '0 auto' }}>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(currentTime / totalDuration) * 100}%` }}></div>
        </div>
        <div className="progress-text">
          <span>{currentTime.toFixed(2)}s</span>
          <span>{totalDuration.toFixed(2)}s</span>
        </div>
      </div>

      <div className="controls-bar">
        <button onClick={handleRestart} disabled={!isReady || isRecording} className="control-btn" title="Restart">
          <RotateCcw size={20} />
        </button>
        <button onClick={isPlaying ? handlePause : handlePlay} disabled={!isReady || isRecording} className="control-btn play-btn" title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause fill="currentColor" size={28} /> : <Play fill="currentColor" size={28} style={{ marginLeft: '4px' }} />}
        </button>
        <button onClick={handleDownload} disabled={!isReady || isRecording} className="control-btn" title="Download">
          <Download size={20} />
        </button>
      </div>

      {isRecording && (
        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--accent-1)', fontWeight: 600, animation: 'pulseGlow 2s infinite' }}>
          <p>{recordingStatus}</p>
        </div>
      )}
    </div>
  );
};