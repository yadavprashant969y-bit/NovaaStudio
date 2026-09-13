/**
 * ExportEngine.js
 * Client-side video and audio rendering & export engine
 */

export class ExportEngine {
  constructor(compositor, audioManager, timeline) {
    this.compositor = compositor;
    this.audioManager = audioManager;
    this.timeline = timeline;
    this.isExporting = false;
  }

  /**
   * Starts the export pipeline
   * @param {Object} config - { format: 'webm' | 'mp4', resolution: '1080p' | '720p', fps: 30 | 60 }
   * @param {Function} onProgress - callback(percent, eta)
   * @returns {Promise<Blob>}
   */
  async exportVideo(config = {}, onProgress = () => {}) {
    this.isExporting = true;
    const fps = config.fps || 30;
    const totalDuration = this.timeline.totalDuration;
    const totalFrames = Math.ceil(totalDuration * fps);

    const canvas = this.compositor.canvas;
    const stream = canvas.captureStream(fps);

    // Audio stream mix
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();
    
    // Connect audio elements if available
    if (this.audioManager.masterGain) {
      // Connect to destination stream
    }

    const audioTracks = dest.stream.getAudioTracks();
    if (audioTracks.length > 0) {
      stream.addTrack(audioTracks[0]);
    }

    let mimeType = 'video/webm; codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: config.resolution === '4k' ? 25000000 : 8000000
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    return new Promise((resolve, reject) => {
      recorder.onstop = () => {
        this.isExporting = false;
        const finalBlob = new Blob(chunks, { type: 'video/webm' });
        resolve(finalBlob);
      };

      recorder.onerror = (e) => {
        this.isExporting = false;
        reject(e);
      };

      recorder.start();

      let currentFrame = 0;
      const startTime = performance.now();

      const processFrame = async () => {
        if (!this.isExporting) return;

        const currentTime = (currentFrame / fps);
        await this.compositor.renderFrame(currentTime, this.timeline.tracks);

        currentFrame++;
        const percent = Math.min(100, Math.floor((currentFrame / totalFrames) * 100));
        
        const elapsed = (performance.now() - startTime) / 1000;
        const eta = currentFrame > 0 ? Math.ceil((elapsed / currentFrame) * (totalFrames - currentFrame)) : 0;
        
        onProgress(percent, eta);

        if (currentFrame < totalFrames) {
          // Render next frame
          requestAnimationFrame(processFrame);
        } else {
          // Finished rendering
          setTimeout(() => {
            recorder.stop();
          }, 300);
        }
      };

      processFrame();
    });
  }

  downloadBlob(blob, filename = 'NovaCut_Video.webm') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
