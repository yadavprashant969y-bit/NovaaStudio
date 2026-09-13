/**
 * CanvasCompositor.js
 * High-performance real-time video, filter, and overlay compositor
 */

export class CanvasCompositor {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    
    this.aspectRatio = '16:9';
    this.width = 1920;
    this.height = 1080;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Cache of loaded HTMLVideoElements keyed by clipId or mediaUrl
    this.videoElements = new Map();
    this.imageElements = new Map();

    // Global Project filter state
    this.globalFilters = {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      exposure: 0,
      sepia: 0,
      blur: 0,
      hueRotate: 0,
      preset: 'none' // 'cinematic' | 'cyberpunk' | 'vintage' | 'bw' | 'glitch' | 'none'
    };
  }

  setAspectRatio(ratio) {
    this.aspectRatio = ratio;
    switch (ratio) {
      case '9:16':
        this.width = 1080;
        this.height = 1920;
        break;
      case '1:1':
        this.width = 1080;
        this.height = 1080;
        break;
      case '4:5':
        this.width = 1080;
        this.height = 1350;
        break;
      case '21:9':
        this.width = 2560;
        this.height = 1080;
        break;
      case '16:9':
      default:
        this.width = 1920;
        this.height = 1080;
        break;
    }
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  /**
   * Loads or gets a cached HTMLVideoElement for a given media URL
   */
  async getOrCreateVideoElement(url) {
    if (this.videoElements.has(url)) {
      return this.videoElements.get(url);
    }
    const video = document.createElement('video');
    video.src = url;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    
    await new Promise((resolve) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => resolve();
    });

    this.videoElements.set(url, video);
    return video;
  }

  /**
   * Main render method called on every frame or scrub
   * @param {number} currentTime - Timeline playhead in seconds
   * @param {Array} tracks - Array of track objects with clips
   */
  async renderFrame(currentTime, tracks, selectedClipId = null) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Dark backdrop
    ctx.fillStyle = '#0a0b10';
    ctx.fillRect(0, 0, this.width, this.height);

    // 1. Render Video Tracks (bottom to top)
    const videoTracks = tracks.filter(t => t.type === 'video');
    for (const track of videoTracks) {
      for (const clip of track.clips) {
        if (currentTime >= clip.startTime && currentTime <= (clip.startTime + clip.duration)) {
          const clipTime = (currentTime - clip.startTime) * (clip.speed || 1) + (clip.trimStart || 0);
          await this.renderVideoClip(clip, clipTime);
        }
      }
    }

    // 2. Render PiP / Overlay Tracks
    const pipTracks = tracks.filter(t => t.type === 'pip');
    for (const track of pipTracks) {
      for (const clip of track.clips) {
        if (currentTime >= clip.startTime && currentTime <= (clip.startTime + clip.duration)) {
          const clipTime = (currentTime - clip.startTime) * (clip.speed || 1) + (clip.trimStart || 0);
          await this.renderVideoClip(clip, clipTime, true);
        }
      }
    }

    // 3. Render Post-Processing / Glitch
    if (this.globalFilters.preset === 'glitch') {
      this.applyGlitchEffect(ctx, currentTime);
    }

    // 4. Render Text & Subtitles Tracks
    const textTracks = tracks.filter(t => t.type === 'text');
    for (const track of textTracks) {
      for (const clip of track.clips) {
        if (currentTime >= clip.startTime && currentTime <= (clip.startTime + clip.duration)) {
          this.renderTextClip(clip, currentTime - clip.startTime);
        }
      }
    }

    // 5. Render Stickers
    const stickerTracks = tracks.filter(t => t.type === 'sticker');
    for (const track of stickerTracks) {
      for (const clip of track.clips) {
        if (currentTime >= clip.startTime && currentTime <= (clip.startTime + clip.duration)) {
          this.renderStickerClip(clip);
        }
      }
    }
  }

  async renderVideoClip(clip, clipTime, isPiP = false) {
    const ctx = this.ctx;
    const video = await this.getOrCreateVideoElement(clip.mediaUrl);
    
    // Seek video element to target time if not playing smoothly
    if (Math.abs(video.currentTime - clipTime) > 0.08) {
      video.currentTime = clipTime;
    }

    ctx.save();

    // Construct CSS Filter string from clip or global filter
    const filters = clip.filters || this.globalFilters;
    let filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) sepia(${filters.sepia}%) blur(${filters.blur}px) hue-rotate(${filters.hueRotate}deg)`;
    
    // Presets
    if (filters.preset === 'cinematic') {
      filterString += ' contrast(115%) saturate(120%) brightness(95%)';
    } else if (filters.preset === 'cyberpunk') {
      filterString += ' hue-rotate(290deg) saturate(180%) contrast(130%)';
    } else if (filters.preset === 'vintage') {
      filterString += ' sepia(50%) contrast(90%) brightness(105%)';
    } else if (filters.preset === 'bw') {
      filterString += ' grayscale(100%) contrast(120%)';
    }

    ctx.filter = filterString;

    // PiP vs Main Layer positioning
    let destX = 0;
    let destY = 0;
    let destW = this.width;
    let destH = this.height;

    if (isPiP) {
      destW = this.width * (clip.scale || 0.35);
      destH = (destW / (video.videoWidth || 16)) * (video.videoHeight || 9);
      destX = (clip.x !== undefined ? clip.x : 0.65) * this.width;
      destY = (clip.y !== undefined ? clip.y : 0.65) * this.height;
      
      // Border & shadow for PiP
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 15;
    } else {
      // Cover fit for main video
      const vRatio = (video.videoWidth || 16) / (video.videoHeight || 9);
      const cRatio = this.width / this.height;
      if (vRatio > cRatio) {
        destH = this.height;
        destW = this.height * vRatio;
        destX = (this.width - destW) / 2;
      } else {
        destW = this.width;
        destH = this.width / vRatio;
        destY = (this.height - destH) / 2;
      }
    }

    if (video.readyState >= 2) {
      ctx.drawImage(video, destX, destY, destW, destH);
    }

    ctx.restore();
  }

  renderTextClip(clip, elapsedInClip) {
    const ctx = this.ctx;
    ctx.save();

    const text = clip.text || 'Sample Title';
    const fontSize = clip.fontSize || 64;
    const fontFamily = clip.fontFamily || 'Outfit, sans-serif';
    const color = clip.color || '#ffffff';
    const strokeColor = clip.strokeColor || '#000000';
    const strokeWidth = clip.strokeWidth || 4;
    const bgColor = clip.bgColor || 'transparent';

    let x = (clip.x !== undefined ? clip.x : 0.5) * this.width;
    let y = (clip.y !== undefined ? clip.y : 0.75) * this.height;

    // Text animations (Pop, Fade, Slide)
    let opacity = 1;
    if (clip.animation === 'fade') {
      if (elapsedInClip < 0.5) opacity = elapsedInClip / 0.5;
    } else if (clip.animation === 'pop') {
      if (elapsedInClip < 0.3) {
        const scale = Math.min(1, elapsedInClip / 0.3);
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.translate(-x, -y);
      }
    } else if (clip.animation === 'slide') {
      if (elapsedInClip < 0.4) {
        const progress = elapsedInClip / 0.4;
        y += (1 - progress) * 60;
      }
    }

    ctx.globalAlpha = opacity;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const boxPaddingX = 24;
    const boxPaddingY = 12;

    // Background pill box if set
    if (bgColor && bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      const rectX = x - textWidth / 2 - boxPaddingX;
      const rectY = y - fontSize / 2 - boxPaddingY;
      const rectW = textWidth + boxPaddingX * 2;
      const rectH = fontSize + boxPaddingY * 2;
      const rad = 8;
      
      ctx.beginPath();
      ctx.roundRect(rectX, rectY, rectW, rectH, rad);
      ctx.fill();
    }

    // Outline / Stroke
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
    }

    // Fill Text
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(text, x, y);

    ctx.restore();
  }

  renderStickerClip(clip) {
    const ctx = this.ctx;
    ctx.save();
    const x = (clip.x !== undefined ? clip.x : 0.8) * this.width;
    const y = (clip.y !== undefined ? clip.y : 0.2) * this.height;
    const size = clip.size || 80;

    ctx.font = `${size}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clip.emoji || '🔥', x, y);
    ctx.restore();
  }

  applyGlitchEffect(ctx, time) {
    if (Math.sin(time * 20) > 0.6) {
      const sliceH = Math.floor(Math.random() * 40) + 10;
      const sliceY = Math.floor(Math.random() * (this.height - sliceH));
      const shiftX = (Math.random() - 0.5) * 40;
      
      const imgData = ctx.getImageData(0, sliceY, this.width, sliceH);
      ctx.putImageData(imgData, shiftX, sliceY);
      
      // Color channel shift
      ctx.fillStyle = 'rgba(255, 0, 128, 0.2)';
      ctx.fillRect(0, sliceY, this.width, sliceH);
    }
  }
}
