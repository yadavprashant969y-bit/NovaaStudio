/**
 * SampleMediaGenerator.js
 * Generates local procedural demo videos, synthesized audio tracks, and stock assets
 * so the editor is 100% functional out of the box with zero external dependencies.
 */

export class SampleMediaGenerator {
  /**
   * Generates an animated video clip procedurally and returns a Blob URL
   * @param {string} theme - 'cyberpunk' | 'sunset' | 'matrix' | 'synthwave'
   * @param {number} duration - seconds
   * @returns {Promise<{url: string, duration: number, title: string, thumbnail: string}>}
   */
  static async generateVideoClip(theme, duration = 6) {
    return new Promise((resolve) => {
      const width = 1280;
      const height = 720;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
      } catch (e) {
        mediaRecorder = new MediaRecorder(stream);
      }

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      let thumbnail = '';
      let startTime = performance.now();
      const totalFrames = duration * 30;
      let frameCount = 0;

      const renderFrame = (t) => {
        ctx.clearRect(0, 0, width, height);

        if (theme === 'cyberpunk') {
          // Dark neon city grid & floating particles
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, '#090a16');
          grad.addColorStop(0.6, '#180e29');
          grad.addColorStop(1, '#ff007f');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);

          // Neon Sun
          ctx.save();
          ctx.beginPath();
          ctx.arc(width / 2, height / 2 + 50, 180, 0, Math.PI * 2);
          const sunGrad = ctx.createLinearGradient(0, height / 2 - 130, 0, height / 2 + 230);
          sunGrad.addColorStop(0, '#ff007f');
          sunGrad.addColorStop(1, '#ffea00');
          ctx.fillStyle = sunGrad;
          ctx.shadowColor = '#ff007f';
          ctx.shadowBlur = 50;
          ctx.fill();
          ctx.restore();

          // Cyber 3D Grid floor
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
          ctx.lineWidth = 2;
          const horizon = height / 2 + 50;
          for (let x = -width; x < width * 2; x += 80) {
            ctx.beginPath();
            ctx.moveTo(width / 2 + (x - width / 2) * 0.1, horizon);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          const offset = (t * 60) % 40;
          for (let y = horizon; y < height; y += (y - horizon) * 0.25 + 10) {
            const drawY = y + offset * ((y - horizon) / (height - horizon));
            if (drawY < height) {
              ctx.beginPath();
              ctx.moveTo(0, drawY);
              ctx.lineTo(width, drawY);
              ctx.stroke();
            }
          }

          // Cyberpunk Text
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 54px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 20;
          ctx.fillText('NOVACUT CYBER CITY', width / 2, 140);
        } else if (theme === 'sunset') {
          // Sunset mountain range with animated sky
          const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
          skyGrad.addColorStop(0, '#1e1b4b');
          skyGrad.addColorStop(0.4, '#c026d3');
          skyGrad.addColorStop(0.8, '#f97316');
          skyGrad.addColorStop(1, '#facc15');
          ctx.fillStyle = skyGrad;
          ctx.fillRect(0, 0, width, height);

          // Glowing Sun
          const sunY = 220 + Math.sin(t * 0.5) * 30;
          ctx.beginPath();
          ctx.arc(width / 2, sunY, 90, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 60;
          ctx.fill();

          // Mountain Silhouettes
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#3b0764';
          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let x = 0; x <= width; x += 100) {
            const my = 400 + Math.sin(x * 0.005 + 1) * 80 + Math.cos(x * 0.01) * 40;
            ctx.lineTo(x, my);
          }
          ctx.lineTo(width, height);
          ctx.fill();

          ctx.fillStyle = '#1e1035';
          ctx.beginPath();
          ctx.moveTo(0, height);
          for (let x = 0; x <= width; x += 80) {
            const my = 520 + Math.sin(x * 0.008 + 3) * 60 + Math.sin(x * 0.02) * 30;
            ctx.lineTo(x, my);
          }
          ctx.lineTo(width, height);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 52px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('GOLDEN HOUR HORIZON', width / 2, 110);
        } else if (theme === 'synthwave') {
          // Synthwave Laser Tunnel
          ctx.fillStyle = '#05050c';
          ctx.fillRect(0, 0, width, height);

          ctx.save();
          ctx.translate(width / 2, height / 2);
          for (let i = 0; i < 8; i++) {
            const size = ((frameCount * 6 + i * 120) % 900);
            ctx.strokeStyle = `hsl(${(t * 40 + i * 45) % 360}, 100%, 65%)`;
            ctx.lineWidth = 4;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.shadowBlur = 15;
            ctx.strokeRect(-size / 2, -size / 2, size, size);
          }
          ctx.restore();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 50px Outfit, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('DYNAMIC MOTION REEL', width / 2, 100);
        }

        // Capture 1st frame thumbnail
        if (frameCount === 1) {
          thumbnail = canvas.toDataURL('image/jpeg', 0.8);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        resolve({
          url,
          duration,
          title: theme === 'cyberpunk' ? 'Cyber City Beat' : theme === 'sunset' ? 'Golden Horizon' : 'Neon Motion Wave',
          thumbnail: thumbnail || canvas.toDataURL('image/jpeg', 0.8)
        });
      };

      mediaRecorder.start();

      const interval = setInterval(() => {
        const t = (frameCount / 30);
        renderFrame(t);
        frameCount++;
        if (frameCount >= totalFrames) {
          clearInterval(interval);
          mediaRecorder.stop();
        }
      }, 1000 / 60); // Fast generate
    });
  }

  /**
   * Generates a synthesized audio track using Web Audio API buffer rendering
   * @param {string} genre - 'synthwave' | 'lofi' | 'cinematic'
   * @param {number} duration - seconds
   * @returns {Promise<{url: string, duration: number, title: string, genre: string}>}
   */
  static async generateSynthesizedAudio(genre, duration = 12) {
    const sampleRate = 44100;
    const ctx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.7, 0);
    masterGain.connect(ctx.destination);

    // BPM & Beat calculations
    const bpm = genre === 'synthwave' ? 120 : genre === 'lofi' ? 84 : 100;
    const beatSec = 60 / bpm;
    const totalBeats = Math.floor(duration / beatSec);

    // Bassline synth
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = genre === 'synthwave' ? 'sawtooth' : 'triangle';

    const notes = genre === 'synthwave' 
      ? [110, 110, 130.81, 98, 110, 146.83, 130.81, 123.47] // A2, C3, G2, D3...
      : [130.81, 164.81, 196.00, 146.83]; // C3, E3, G3, D3

    for (let beat = 0; beat < totalBeats; beat++) {
      const noteTime = beat * beatSec;
      const noteFreq = notes[beat % notes.length];
      bassOsc.frequency.setValueAtTime(noteFreq, noteTime);

      bassGain.gain.setValueAtTime(0.5, noteTime);
      bassGain.gain.exponentialRampToValueAtTime(0.01, noteTime + beatSec * 0.9);

      // Kick drum
      if (beat % 2 === 0 || genre === 'synthwave') {
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.frequency.setValueAtTime(150, noteTime);
        kickOsc.frequency.exponentialRampToValueAtTime(30, noteTime + 0.15);
        kickGain.gain.setValueAtTime(0.9, noteTime);
        kickGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.2);
        kickOsc.connect(kickGain);
        kickGain.connect(masterGain);
        kickOsc.start(noteTime);
        kickOsc.stop(noteTime + 0.25);
      }

      // Snare / Clap
      if (beat % 2 === 1) {
        const snareNoise = ctx.createBufferSource();
        const noiseBuf = ctx.createBuffer(1, sampleRate * 0.1, sampleRate);
        const output = noiseBuf.getChannelData(0);
        for (let i = 0; i < sampleRate * 0.1; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        snareNoise.buffer = noiseBuf;
        const snareGain = ctx.createGain();
        snareGain.gain.setValueAtTime(0.35, noteTime);
        snareGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.12);
        snareNoise.connect(snareGain);
        snareGain.connect(masterGain);
        snareNoise.start(noteTime);
      }
    }

    bassOsc.connect(bassGain);
    bassGain.connect(masterGain);
    bassOsc.start(0);
    bassOsc.stop(duration);

    const renderedBuffer = await ctx.startRendering();
    const wavBlob = bufferToWaveBlob(renderedBuffer, sampleRate * duration);
    const url = URL.createObjectURL(wavBlob);

    return {
      url,
      duration,
      title: genre === 'synthwave' ? 'Neon Pulse Beat' : genre === 'lofi' ? 'Midnight Coffee' : 'Cinematic Uplift',
      genre: genre.toUpperCase()
    };
  }
}

/**
 * Encodes AudioBuffer into standard WAV Blob
 */
function bufferToWaveBlob(abuffer, len) {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
  function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8);  // file length - 8
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16);          // SubChunk1Size (16 for PCM)
  setUint16(1);           // AudioFormat (1 for PCM)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // byte rate
  setUint16(numOfChan * 2);                      // block align
  setUint16(16);                                 // bits per sample

  // data sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(length - pos - 4);

  for (let i = 0; i < abuffer.numberOfChannels; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out], { type: 'audio/wav' });
}
