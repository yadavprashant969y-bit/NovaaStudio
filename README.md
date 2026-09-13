# NovaCut Studio

A powerful, cross-platform video editing studio built for the web, desktop, and mobile. NovaCut provides a professional multi-track timeline, cinematic filters, audio mixing, text overlays, and fast rendering directly in the browser.

## Features

- **Multi-Track Timeline**: Layer multiple video clips, audio tracks, text overlays, and stickers.
- **Cinematic LUTs & Styles**: Apply professional color grading presets (Cinematic, Cyberpunk, Vintage, B&W).
- **Audio Mixing**: Upload audio files, record voiceovers directly in the app, and mix audio tracks.
- **Cross-Platform**: Fully responsive mobile-friendly UI with bottom-sheet navigation.
- **Client-Side Rendering**: Fast video exporting without requiring expensive backend server processing.

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, CSS3
- **Rendering Engine**: HTML5 Canvas API & WebCodecs / MediaRecorder
- **Deployment**: Vercel (Speed Insights integrated)
- **Mobile Packaging**: Capacitor (for Android/iOS builds)

## Local Development

To run the editor locally:

1. Clone this repository.
2. Run a local development server (e.g., using Python):
   ```bash
   python3 -m http.server 8080
   ```
3. Open `http://localhost:8080` in your web browser.

## License

MIT License
