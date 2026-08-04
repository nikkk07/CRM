/** @type {import('tailwindcss').Config} */
// Wire in liquidglass-tailwind's *theme tokens only* (additive, non-colliding):
// this exposes bg-glass-*, border-glass-border-*, rounded-glass-*, and
// shadow-glass-* across the app. We intentionally do NOT register the full
// plugin — its component classes (.glass-card/.glass-btn/.glass-nav/…) collide
// with our hand-tuned light-mode system in src/index.css, and its
// prefers-reduced-transparency base rule would force our white content cards to
// an opaque dark background (a readability regression). Authentic refraction and
// specular shine are self-hosted in src/index.css instead.
import { liquidGlassTheme } from 'liquidglass-tailwind/theme';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      ...liquidGlassTheme,
    },
  },
  plugins: [],
}
