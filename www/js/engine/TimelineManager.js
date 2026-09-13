/**
 * TimelineManager.js
 * Multi-track state manager, clip trimmer, cutter, and timeline renderer
 */

export class TimelineManager {
  constructor(options = {}) {
    this.rulerCanvas = options.rulerCanvas;
    this.tracksContainer = options.tracksContainer;
    this.playheadEl = options.playheadEl;
    this.onTimeUpdate = options.onTimeUpdate || (() => {});
    this.onSelectClip = options.onSelectClip || (() => {});

    this.currentTime = 0; // Current playhead in seconds
    this.totalDuration = 15; // Total project duration in seconds
    this.pixelsPerSecond = 50; // Timeline Zoom factor (50px = 1 sec)
    this.isPlaying = false;
    this.selectedClipId = null;

    // Default tracks
    this.tracks = [
      { id: 'track-text-1', name: 'Text & Captions', type: 'text', clips: [] },
      { id: 'track-pip-1', name: 'Overlay / Stickers', type: 'sticker', clips: [] },
      { id: 'track-video-1', name: 'Main Video', type: 'video', clips: [] },
      { id: 'track-audio-1', name: 'Audio & Music', type: 'audio', clips: [] }
    ];

    this.initEventListeners();
    this.render();
  }

  initEventListeners() {
    // Ruler click/scrub
    if (this.rulerCanvas) {
      const handleRulerScrub = (e) => {
        const rect = this.rulerCanvas.getBoundingClientRect();
        const scrollLeft = this.tracksContainer.parentElement.scrollLeft;
        const clickX = e.clientX - rect.left + scrollLeft;
        const targetTime = Math.max(0, clickX / this.pixelsPerSecond);
        this.seek(targetTime);
      };

      let isScrubbing = false;
      this.rulerCanvas.addEventListener('mousedown', (e) => {
        isScrubbing = true;
        handleRulerScrub(e);
      });
      window.addEventListener('mousemove', (e) => {
        if (isScrubbing) handleRulerScrub(e);
      });
      window.addEventListener('mouseup', () => {
        isScrubbing = false;
      });
    }
  }

  setZoom(zoomFactor) {
    this.pixelsPerSecond = Math.max(15, Math.min(200, zoomFactor));
    this.render();
  }

  seek(time) {
    this.currentTime = Math.max(0, Math.min(this.totalDuration, time));
    this.updatePlayheadPosition();
    this.onTimeUpdate(this.currentTime);
  }

  updatePlayheadPosition() {
    if (this.playheadEl) {
      const leftPx = this.currentTime * this.pixelsPerSecond;
      this.playheadEl.style.transform = `translateX(${leftPx}px)`;
    }
  }

  addClip(trackId, clipData) {
    const track = this.tracks.find(t => t.id === trackId);
    if (!track) return null;

    // Find first available slot or place after last clip
    let startTime = 0;
    if (track.clips.length > 0) {
      const lastClip = track.clips[track.clips.length - 1];
      startTime = lastClip.startTime + lastClip.duration;
    }

    const clip = {
      id: 'clip_' + Math.random().toString(36).substr(2, 9),
      name: clipData.title || clipData.name || 'Untitled Clip',
      mediaUrl: clipData.url || '',
      startTime: startTime,
      duration: clipData.duration || 5,
      trimStart: 0,
      speed: 1,
      volume: 1,
      filters: { ...clipData.filters },
      ...clipData
    };

    track.clips.push(clip);
    this.recalculateTotalDuration();
    this.selectClip(clip.id);
    this.render();
    return clip;
  }

  selectClip(clipId) {
    this.selectedClipId = clipId;
    let selectedClip = null;
    let selectedTrack = null;

    for (const track of this.tracks) {
      const found = track.clips.find(c => c.id === clipId);
      if (found) {
        selectedClip = found;
        selectedTrack = track;
        break;
      }
    }

    this.onSelectClip(selectedClip, selectedTrack);
    this.renderTrackClips();
  }

  getSelectedClip() {
    if (!this.selectedClipId) return null;
    for (const track of this.tracks) {
      const found = track.clips.find(c => c.id === this.selectedClipId);
      if (found) return { clip: found, track };
    }
    return null;
  }

  /**
   * Split selected clip at current playhead
   */
  splitSelectedClip() {
    const selected = this.getSelectedClip();
    if (!selected) return false;

    const { clip, track } = selected;
    const playheadTime = this.currentTime;

    // Check if playhead is strictly inside the clip
    if (playheadTime <= clip.startTime + 0.1 || playheadTime >= clip.startTime + clip.duration - 0.1) {
      return false;
    }

    const splitOffset = playheadTime - clip.startTime;
    const originalDuration = clip.duration;

    // 1st half
    clip.duration = splitOffset;

    // 2nd half
    const newClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: 'clip_' + Math.random().toString(36).substr(2, 9),
      name: clip.name + ' (Part 2)',
      startTime: playheadTime,
      duration: originalDuration - splitOffset,
      trimStart: (clip.trimStart || 0) + splitOffset * (clip.speed || 1)
    };

    track.clips.push(newClip);
    track.clips.sort((a, b) => a.startTime - b.startTime);

    this.selectClip(newClip.id);
    this.render();
    return true;
  }

  deleteSelectedClip() {
    if (!this.selectedClipId) return;
    for (const track of this.tracks) {
      const idx = track.clips.findIndex(c => c.id === this.selectedClipId);
      if (idx !== -1) {
        track.clips.splice(idx, 1);
        this.selectedClipId = null;
        this.onSelectClip(null, null);
        this.recalculateTotalDuration();
        this.render();
        break;
      }
    }
  }

  duplicateSelectedClip() {
    const selected = this.getSelectedClip();
    if (!selected) return;
    const { clip, track } = selected;
    const newClip = {
      ...JSON.parse(JSON.stringify(clip)),
      id: 'clip_' + Math.random().toString(36).substr(2, 9),
      name: clip.name + ' (Copy)',
      startTime: clip.startTime + clip.duration + 0.2
    };
    track.clips.push(newClip);
    this.recalculateTotalDuration();
    this.selectClip(newClip.id);
    this.render();
  }

  recalculateTotalDuration() {
    let maxTime = 10;
    for (const track of this.tracks) {
      for (const clip of track.clips) {
        const endTime = clip.startTime + clip.duration;
        if (endTime > maxTime) maxTime = endTime;
      }
    }
    this.totalDuration = Math.ceil(maxTime + 2);
  }

  render() {
    this.renderRuler();
    this.renderTrackClips();
    this.updatePlayheadPosition();
  }

  renderRuler() {
    if (!this.rulerCanvas) return;
    const canvas = this.rulerCanvas;
    const ctx = canvas.getContext('2d');
    const width = Math.max(canvas.parentElement.clientWidth, this.totalDuration * this.pixelsPerSecond + 200);
    
    canvas.width = width;
    canvas.height = 28;

    ctx.clearRect(0, 0, width, 28);
    ctx.fillStyle = '#12141e';
    ctx.fillRect(0, 0, width, 28);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.lineWidth = 1;

    const stepSec = this.pixelsPerSecond < 30 ? 5 : this.pixelsPerSecond < 70 ? 1 : 0.5;

    for (let t = 0; t <= this.totalDuration; t += stepSec) {
      const x = t * this.pixelsPerSecond;
      const isMajor = Number.isInteger(t);

      ctx.beginPath();
      ctx.moveTo(x, isMajor ? 12 : 20);
      ctx.lineTo(x, 28);
      ctx.stroke();

      if (isMajor) {
        const mins = Math.floor(t / 60);
        const secs = (t % 60).toString().padStart(2, '0');
        ctx.fillText(`${mins}:${secs}`, x + 4, 14);
      }
    }
  }

  renderTrackClips() {
    if (!this.tracksContainer) return;
    this.tracksContainer.innerHTML = '';

    const width = Math.max(this.tracksContainer.parentElement.clientWidth, this.totalDuration * this.pixelsPerSecond + 200);
    this.tracksContainer.style.width = width + 'px';

    this.tracks.forEach((track) => {
      const trackRow = document.createElement('div');
      trackRow.className = 'track-row';
      trackRow.dataset.trackId = track.id;

      track.clips.forEach((clip) => {
        const clipEl = document.createElement('div');
        clipEl.className = `timeline-clip ${clip.type}-clip ${clip.id === this.selectedClipId ? 'selected' : ''}`;
        
        const leftPx = clip.startTime * this.pixelsPerSecond;
        const widthPx = Math.max(20, clip.duration * this.pixelsPerSecond);
        clipEl.style.left = `${leftPx}px`;
        clipEl.style.width = `${widthPx}px`;

        // Clip label
        const label = document.createElement('span');
        label.className = 'clip-label';
        label.textContent = clip.name;
        clipEl.appendChild(label);

        // Trim Handles
        const leftHandle = document.createElement('div');
        leftHandle.className = 'clip-trim-handle clip-trim-left';
        const rightHandle = document.createElement('div');
        rightHandle.className = 'clip-trim-handle clip-trim-right';
        clipEl.appendChild(leftHandle);
        clipEl.appendChild(rightHandle);

        // Click Selection
        clipEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectClip(clip.id);
        });

        // Drag Clip Movement
        this.makeClipDraggable(clipEl, clip);
        this.makeClipTrimmable(leftHandle, rightHandle, clip);

        trackRow.appendChild(clipEl);
      });

      this.tracksContainer.appendChild(trackRow);
    });
  }

  makeClipDraggable(clipEl, clip) {
    let startX = 0;
    let initialStartTime = 0;
    let isDragging = false;

    clipEl.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('clip-trim-handle')) return;
      isDragging = true;
      startX = e.clientX;
      initialStartTime = clip.startTime;
      this.selectClip(clip.id);

      const onMouseMove = (moveEv) => {
        if (!isDragging) return;
        const deltaX = moveEv.clientX - startX;
        const deltaTime = deltaX / this.pixelsPerSecond;
        clip.startTime = Math.max(0, initialStartTime + deltaTime);
        clipEl.style.left = `${clip.startTime * this.pixelsPerSecond}px`;
        this.recalculateTotalDuration();
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.render();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  makeClipTrimmable(leftHandle, rightHandle, clip) {
    // Left trim
    leftHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      let startX = e.clientX;
      let initialStart = clip.startTime;
      let initialDuration = clip.duration;

      const onMove = (moveEv) => {
        const deltaX = moveEv.clientX - startX;
        const deltaTime = deltaX / this.pixelsPerSecond;
        if (initialDuration - deltaTime > 0.3) {
          clip.startTime = Math.max(0, initialStart + deltaTime);
          clip.duration = initialDuration - deltaTime;
          clip.trimStart = (clip.trimStart || 0) + deltaTime;
          this.render();
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    // Right trim
    rightHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      let startX = e.clientX;
      let initialDuration = clip.duration;

      const onMove = (moveEv) => {
        const deltaX = moveEv.clientX - startX;
        const deltaTime = deltaX / this.pixelsPerSecond;
        if (initialDuration + deltaTime > 0.3) {
          clip.duration = initialDuration + deltaTime;
          this.recalculateTotalDuration();
          this.render();
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }
}
