import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // `dark:` utilities apply when the root carries data-theme="dark" (the theme
  // toggle stamps it). Used only where a status color needs a lighter/darker
  // shade per theme; core surfaces re-theme via the CSS-variable colors below.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        council: {
          bg: 'var(--c-bg)',
          panel: 'var(--c-panel)',
          panel2: 'var(--c-panel2)',
          border: 'var(--c-border)',
          accent: 'var(--c-accent)',
          text: 'var(--c-text)',
          muted: 'var(--c-muted)',
          faint: 'var(--c-faint)',
          strong: 'var(--c-strong)',
          line: 'var(--c-line)',
          code: 'var(--c-code)',
          // Fixed dark ink for text sitting on a bright accent circle/pill —
          // must not flip with the theme (the accents stay bright in both).
          onaccent: '#0b1220',
          chatgpt: '#10a37f',
          claude: '#d97757',
          gemini: '#4285f4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
}
