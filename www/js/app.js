/**
 * app.js
 * Main UI Controller and Orchestrator for NovaCut Studio
 */

import { CanvasCompositor } from './engine/CanvasCompositor.js';
import { AudioManager } from './engine/AudioManager.js';
import { TimelineManager } from './engine/TimelineManager.js';
import { ExportEngine } from './engine/ExportEngine.js';
import { SampleMediaGenerator } from './engine/SampleMediaGenerator.js';

class NovaCutApp {
  constructor() {
    this.canvas = document.getElementById('previewCanvas');
    this.rulerCanvas = document.getElementById('rulerCanvas');
    this.tracksContainer = document.getElementById('tracksContainer');
    this.playheadEl = document.getElementById('playheadNeedle');
    
    this.compositor = new CanvasCompositor(this.canvas);
    this.audioManager = new AudioManager();
    this.timeline = new TimelineManager({
      rulerCanvas: this.rulerCanvas,
      tracksContainer: this.tracksContainer,
      playheadEl: this.playheadEl,
      onTimeUpdate: (time) => this.handleTimeUpdate(time),
      onSelectClip: (clip, track) => this.handleSelectClip(clip, track)
    });

    this.exportEngine = new ExportEngine(this.compositor, this.audioManager, this.timeline);

    this.isPlaying = false;
    this.animationFrameId = null;
    this.lastPlaybackTime = 0;

    this.initUI();
    this.loadInitialDemoAssets();
  }

  initUI() {
    // Play / Pause
    const playBtn = document.getElementById('playPauseBtn');
    playBtn.addEventListener('click', () => this.togglePlayback());

    // Aspect Ratio Buttons
    document.querySelectorAll('.aspect-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.aspect-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const ratio = btn.dataset.ratio;
        this.compositor.setAspectRatio(ratio);
        this.compositor.renderFrame(this.timeline.currentTime, this.timeline.tracks);
        this.showToast(`Aspect ratio set to ${ratio}`);
      });
    });

    // Sidebar Tabs
    document.querySelectorAll('.sidebar-tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-tab-btn').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const targetPane = document.getElementById(`tab-${tab.dataset.tab}`);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Timeline Zoom Slider
    const zoomSlider = document.getElementById('timelineZoomSlider');
    if (zoomSlider) {
      zoomSlider.addEventListener('input', (e) => {
        this.timeline.setZoom(Number(e.target.value));
      });
    }

    // Timeline Split Button
    document.getElementById('splitClipBtn')?.addEventListener('click', () => {
      const split = this.timeline.splitSelectedClip();
      if (split) {
        this.showToast('Clip split at playhead (S)');
      } else {
        this.showToast('Position playhead inside clip to split', 'warning');
      }
    });

    // Timeline Delete Button
    document.getElementById('deleteClipBtn')?.addEventListener('click', () => {
      this.timeline.deleteSelectedClip();
      this.compositor.renderFrame(this.timeline.currentTime, this.timeline.tracks);
      this.showToast('Clip deleted');
    });

    // Timeline Duplicate Button
    document.getElementById('duplicateClipBtn')?.addEventListener('click', () => {
      this.timeline.duplicateSelectedClip();
      this.showToast('Clip duplicated');
    });

    // Device View Toggle (Desktop vs Mobile simulation)
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (btn.dataset.device === 'mobile') {
          document.body.classList.add('mobile-mode');
          this.showToast('Switched to Mobile Reel mode');
        } else {
          document.body.classList.remove('mobile-mode');
          this.showToast('Switched to Desktop Studio mode');
        }
      });
    });

    // File Upload Handler
    const fileInput = document.getElementById('mediaFileInput');
    const dropzone = document.getElementById('uploadDropzone');
    dropzone?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      this.handleUserUploadedFiles(files);
    });

    // Drag & Drop to Upload
    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files);
      this.handleUserUploadedFiles(files);
    });

    // Export Modal Trigger
    const exportModal = document.getElementById('exportModal');
    document.getElementById('openExportBtn')?.addEventListener('click', () => {
      exportModal.classList.add('open');
    });
    document.getElementById('closeExportModal')?.addEventListener('click', () => {
      exportModal.classList.remove('open');
    });

    // Start Export Action
    document.getElementById('startExportActionBtn')?.addEventListener('click', async () => {
      const progressContainer = document.getElementById('exportProgressSection');
      const progressBar = document.getElementById('exportProgressBar');
      const progressText = document.getElementById('exportProgressText');
      const startBtn = document.getElementById('startExportActionBtn');

      progressContainer.style.display = 'block';
      startBtn.disabled = true;

      const resolution = document.getElementById('exportResolutionSelect').value;
      const fps = Number(document.getElementById('exportFpsSelect').value);

      this.pause();

      try {
        const blob = await this.exportEngine.exportVideo({ resolution, fps }, (percent, eta) => {
          progressBar.style.width = `${percent}%`;
          progressText.textContent = `Rendering: ${percent}% (ETA: ${eta}s)`;
        });

        this.exportEngine.downloadBlob(blob, 'NovaCut_Studio_Export.webm');
        this.showToast('🎉 Video successfully exported and downloaded!');
        setTimeout(() => {
          exportModal.classList.remove('open');
          progressContainer.style.display = 'none';
          progressBar.style.width = '0%';
          startBtn.disabled = false;
        }, 1500);
      } catch (err) {
        console.error(err);
        this.showToast('Export error: ' + err.message, 'error');
        startBtn.disabled = false;
      }
    });

    // Voice Recorder Button
    const recordVoiceBtn = document.getElementById('recordVoiceBtn');
    let isRecordingVoice = false;
    recordVoiceBtn?.addEventListener('click', async () => {
      if (!isRecordingVoice) {
        try {
          await this.audioManager.startVoiceRecording();
          isRecordingVoice = true;
          recordVoiceBtn.textContent = '🔴 Stop Recording';
          recordVoiceBtn.classList.add('recording');
          this.showToast('Recording voiceover...');
        } catch (e) {
          this.showToast('Mic access denied', 'error');
        }
      } else {
        const voiceData = await this.audioManager.stopVoiceRecording();
        isRecordingVoice = false;
        recordVoiceBtn.textContent = '🎤 Record Voiceover';
        recordVoiceBtn.classList.remove('recording');
        if (voiceData) {
          this.timeline.addClip('track-audio-1', {
            title: voiceData.title,
            url: voiceData.url,
            duration: voiceData.duration,
            type: 'audio'
          });
          this.showToast('Voiceover added to audio track!');
        }
      }
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayback();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        this.timeline.splitSelectedClip();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        this.timeline.deleteSelectedClip();
        this.compositor.renderFrame(this.timeline.currentTime, this.timeline.tracks);
      }
    });

    // Inspector Control Bindings
    this.initInspectorBindings();
  }

  initInspectorBindings() {
    const bindSlider = (id, prop, isClipFilter = false) => {
      const slider = document.getElementById(id);
      const valDisplay = document.getElementById(id + 'Val');
      if (!slider) return;

      slider.addEventListener('input', (e) => {
        const val = Number(e.target.value);
        if (valDisplay) valDisplay.textContent = val;

        const selected = this.timeline.getSelectedClip();
        if (selected) {
          if (isClipFilter) {
            selected.clip.filters = selected.clip.filters || {};
            selected.clip.filters[prop] = val;
          } else {
            selected.clip[prop] = val;
          }
        } else {
          this.compositor.globalFilters[prop] = val;
        }
        this.compositor.renderFrame(this.timeline.currentTime, this.timeline.tracks);
      });
    };

    bindSlider('filterBrightness', 'brightness', true);
    bindSlider('filterContrast', 'contrast', true);
    bindSlider('filterSaturation', 'saturation', true);
    bindSlider('filterBlur', 'blur', true);
    bindSlider('filterHue', 'hueRotate', true);
    bindSlider('clipSpeed', 'speed');
    bindSlider('clipVolume', 'volume');

    // Text Inspector Inputs
    const textInput = document.getElementById('textClipInput');
    textInput?.addEventListener('input', (e) => {
      const selected = this.timeline.getSelectedClip();
      if (selected && selected.clip.type === 'text') {
        selected.clip.text = e.target.value;
        this.compositor.renderFrame(this.timeline.currentTime, this.timeline.tracks);
      }
    });

    const textColor = document.getElementById('textColorInput');
    textColor?.addEventListener('input', (e) => {
      const selected = this.timeline.getSelectedClip();
      if (selected && selected.clip.type === 'text') {
        selected.clip.color = e.target.value;
        this.compositor.renderFrame(this.timeline.currentTime, this.timeline.tracks);
      }
    });

    const textBg = document.getElementById('textBgInput');
    textBg?.addEventListener('input', (e) => {
      const selected = this.timeline.getSelectedClip();
      if (selected && selected.clip.type === 'text') {
        selected.clip.bgColor = e.target.value;
        this.compositor.renderFrame(this.timeline.currentTime, this.timeline.tracks);
      }
    });

    // Preset Filter Cards
    document.querySelectorAll('.filter-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.filter-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const preset = card.dataset.filter;
        this.compositor.globalFilters.preset = preset;
        this.compositor.renderFrame(this.timeline.currentTime, this.timeline.tracks);
        this.showToast(`Applied ${preset.toUpperCase()} filter`);
      });
    });
  }

  async loadInitialDemoAssets() {
    this.showToast('Loading studio assets...', 'info');

    try {
      // 1. Generate Demo Clips
      const cyberpunkClip = await SampleMediaGenerator.generateVideoClip('cyberpunk', 6);
      const sunsetClip = await SampleMediaGenerator.generateVideoClip('sunset', 6);
      const synthwaveAudio = await SampleMediaGenerator.generateSynthesizedAudio('synthwave', 12);
      const lofiAudio = await SampleMediaGenerator.generateSynthesizedAudio('lofi', 12);

      // Populate Media Bin Cards
      this.addMediaCardToBin(cyberpunkClip, 'video');
      this.addMediaCardToBin(sunsetClip, 'video');
      this.addAudioItemToBin(synthwaveAudio);
      this.addAudioItemToBin(lofiAudio);

      // Add to timeline
      this.timeline.addClip('track-video-1', {
        title: cyberpunkClip.title,
        url: cyberpunkClip.url,
        duration: cyberpunkClip.duration,
        type: 'video'
      });

      this.timeline.addClip('track-video-1', {
        title: sunsetClip.title,
        url: sunsetClip.url,
        duration: sunsetClip.duration,
        type: 'video'
      });

      this.timeline.addClip('track-text-1', {
        title: 'Title: Welcome',
        text: '⚡ NOVACUT STUDIO',
        fontSize: 68,
        color: '#ffffff',
        bgColor: 'rgba(139, 92, 246, 0.75)',
        strokeColor: '#000000',
        strokeWidth: 3,
        animation: 'pop',
        duration: 4,
        type: 'text'
      });

      this.timeline.addClip('track-audio-1', {
        title: synthwaveAudio.title,
        url: synthwaveAudio.url,
        duration: 12,
        type: 'audio',
        volume: 0.8
      });

      this.timeline.addClip('track-pip-1', {
        title: 'Sticker Flame',
        emoji: '🔥',
        duration: 5,
        type: 'sticker'
      });

      // Render initial frame
      this.compositor.renderFrame(0, this.timeline.tracks);
      this.showToast('🚀 Ready to edit! Press Space to Play');
    } catch (e) {
      console.error(e);
    }
  }

  addMediaCardToBin(mediaData, type = 'video') {
    const grid = document.getElementById('mediaBinGrid');
    if (!grid) return;

    const card = document.createElement('div');
    card.className = 'media-card';
    card.innerHTML = `
      <img src="${mediaData.thumbnail}" alt="${mediaData.title}" />
      <button class="add-to-timeline-btn" title="Add to Timeline">+</button>
      <div class="media-card-overlay">
        <span class="media-title">${mediaData.title}</span>
        <span class="media-duration">${mediaData.duration}s</span>
      </div>
    `;

    card.querySelector('.add-to-timeline-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.timeline.addClip('track-video-1', {
        title: mediaData.title,
        url: mediaData.url,
        duration: mediaData.duration,
        type: 'video'
      });
      this.showToast(`Added ${mediaData.title} to timeline`);
    });

    grid.appendChild(card);
  }

  addAudioItemToBin(audioData) {
    const list = document.getElementById('audioBinList');
    if (!list) return;

    const item = document.createElement('div');
    item.className = 'audio-item';
    item.innerHTML = `
      <button class="audio-play-btn">▶</button>
      <div class="audio-info">
        <div class="audio-name">${audioData.title}</div>
        <div class="audio-sub">${audioData.genre} • ${audioData.duration}s</div>
      </div>
      <button class="tool-btn add-audio-btn" style="padding: 4px 8px;">+ Add</button>
    `;

    item.querySelector('.add-audio-btn').addEventListener('click', () => {
      this.timeline.addClip('track-audio-1', {
        title: audioData.title,
        url: audioData.url,
        duration: audioData.duration,
        type: 'audio'
      });
      this.showToast(`Added ${audioData.title} to audio track`);
    });

    list.appendChild(item);
  }

  handleUserUploadedFiles(files) {
    files.forEach(file => {
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = url;
        video.onloadedmetadata = () => {
          const data = {
            title: file.name,
            url,
            duration: Math.round(video.duration),
            thumbnail: ''
          };
          this.addMediaCardToBin(data, 'video');
          this.timeline.addClip('track-video-1', { ...data, type: 'video' });
          this.showToast(`Imported ${file.name}`);
        };
      } else if (file.type.startsWith('audio/')) {
        const audio = new Audio(url);
        audio.onloadedmetadata = () => {
          const data = {
            title: file.name,
            url,
            duration: Math.round(audio.duration),
            genre: 'USER AUDIO'
          };
          this.addAudioItemToBin(data);
          this.timeline.addClip('track-audio-1', { ...data, type: 'audio' });
          this.showToast(`Imported audio ${file.name}`);
        };
      }
    });
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    this.isPlaying = true;
    this.audioManager.init();
    this.lastPlaybackTime = performance.now();
    document.getElementById('playPauseIcon').textContent = '⏸';

    const loop = (timestamp) => {
      if (!this.isPlaying) return;

      const delta = (timestamp - this.lastPlaybackTime) / 1000;
      this.lastPlaybackTime = timestamp;

      let nextTime = this.timeline.currentTime + delta;
      if (nextTime >= this.timeline.totalDuration) {
        nextTime = 0; // Loop or stop
      }

      this.timeline.seek(nextTime);
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  pause() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.audioManager.stopAll();
    document.getElementById('playPauseIcon').textContent = '▶';
  }

  handleTimeUpdate(currentTime) {
    this.updateTimecodeDisplay(currentTime);
    this.compositor.renderFrame(currentTime, this.timeline.tracks);
    this.audioManager.syncPlayback(currentTime, this.timeline.tracks.filter(t => t.type === 'audio'), this.isPlaying);
  }

  handleSelectClip(clip, track) {
    const inspectorVideoGroup = document.getElementById('inspectorVideoGroup');
    const inspectorTextGroup = document.getElementById('inspectorTextGroup');
    const inspectorSelectionTitle = document.getElementById('inspectorSelectionTitle');

    if (!clip) {
      inspectorSelectionTitle.textContent = 'Global Project Settings';
      if (inspectorTextGroup) inspectorTextGroup.style.display = 'none';
      return;
    }

    inspectorSelectionTitle.textContent = `${clip.name} (${clip.type.toUpperCase()})`;

    if (clip.type === 'text') {
      if (inspectorTextGroup) inspectorTextGroup.style.display = 'flex';
      const textInput = document.getElementById('textClipInput');
      if (textInput) textInput.value = clip.text || '';
    } else {
      if (inspectorTextGroup) inspectorTextGroup.style.display = 'none';
    }
  }

  updateTimecodeDisplay(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    const formattedCurrent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;

    const totalSecs = this.timeline.totalDuration;
    const tMins = Math.floor(totalSecs / 60);
    const tSecs = Math.floor(totalSecs % 60);
    const formattedTotal = `${tMins.toString().padStart(2, '0')}:${tSecs.toString().padStart(2, '0')}`;

    const timecodeEl = document.getElementById('timecodeDisplay');
    if (timecodeEl) {
      timecodeEl.innerHTML = `<span class="timecode-current">${formattedCurrent}</span> / ${formattedTotal}`;
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.novaCutApp = new NovaCutApp();
});
