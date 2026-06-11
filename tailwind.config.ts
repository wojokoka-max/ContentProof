import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#0f0f0f',
          60: '#666462',
          40: '#99979a',
          20: '#cccbce',
          10: '#e5e4e6',
          5:  '#f2f1f3',
        },
        signal: {
          green:  '#1a7a4a',
          amber:  '#92580a',
          red:    '#9b1c1c',
          'green-bg': '#edfaf3',
          'amber-bg': '#fdf6e8',
          'red-bg':   '#fff0f0',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease both',
        'fade-in':    'fadeIn 0.3s ease both',
        'score-fill': 'scoreFill 1s cubic-bezier(.16,1,.3,1) both',
        'slide-in':   'slideIn 0.35s ease both',
      },
      keyframes: {
        fadeUp:    { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        scoreFill: { from: { width: '0%' }, to: { width: 'var(--score-w)' } },
        slideIn:   { from: { opacity: '0', transform: 'translateX(-8px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};

export default config;
