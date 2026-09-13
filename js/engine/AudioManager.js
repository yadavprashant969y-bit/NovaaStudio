/**
 * AudioManager.js
 * Multi-track Web Audio mixer and voiceover recorder
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.activeSources = new Map(); // clipId -> { audioEl, sourceNode, gainNode }
    this.isPlaying = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Synchronizes audio clips to the timeline playhead
   */
  syncPlayback(currentTime, audioTracks, isPlaying) {
    this.init();
    this.isPlaying = isPlaying;

    for (const track of audioTracks) {
      for (const clip of track.clips) {
        const isWithinClip = currentTime >= clip.startTime && currentTime <= (clip.startTime + clip.duration);
        
        if (isWithinClip && isPlaying) {
          this.playClipAudio(clip, currentTime);
        } else {
          this.pauseClipAudio(clip.id);
        }
      }
    }
  }

  playClipAudio(clip, currentTime) {
    let entry = this.activeSources.get(clip.id);
    if (!entry) {
      const audio = new Audio(clip.mediaUrl);
      audio.crossOrigin = 'anonymous';
      const source = this.ctx.createMediaElementSource(audio);
      const gain = this.ctx.createGain();
      
      source.connect(gain);
      gain.connect(this.masterGain);
      entry = { audio, source, gain };
      this.activeSources.set(clip.id, entry);
    }

    const clipOffset = (currentTime - clip.startTime) * (clip.speed || 1) + (clip.trimStart || 0);
    const audio = entry.audio;
    const gain = entry.gain;

    // Apply volume & fade envelopes
    const vol = clip.volume !== undefined ? clip.volume : 1.0;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);

    if (Math.abs(audio.currentTime - clipOffset) > 0.15) {
      audio.currentTime = clipOffset;
    }

    if (audio.paused) {
      audio.play().catch(() => {});
    }
  }

  pauseClipAudio(clipId) {
    const entry = this.activeSources.get(clipId);
    if (entry && !entry.audio.paused) {
      entry.audio.pause();
    }
  }

  stopAll() {
    for (const [clipId, entry] of this.activeSources.entries()) {
      if (!entry.audio.paused) {
        entry.audio.pause();
      }
    }
  }

  /**
   * Records live microphone voiceover
   */
  async startVoiceRecording() {
    this.recordedChunks = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(stream);
    
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.start();
  }

  async stopVoiceRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(null);
      
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
          resolve({
            url,
            duration: audio.duration || 4,
            title: 'Mic Voiceover ' + new Date().toLocaleTimeString()
          });
        };
      };

      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(t => t.stop());
    });
  }
}
