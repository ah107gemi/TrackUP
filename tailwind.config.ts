import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#101014',
        surface: {
          DEFAULT: '#16161D',
          elevated: '#1F1F29',
        },
        accent: {
          DEFAULT: '#FFC400',
          hover: '#FFD033',
        },
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
        },
        status: {
          watching: '#FFC400',
          completed: '#10B981',
          planned: '#38BDF8',
          paused: '#F59E0B',
          dropped: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
