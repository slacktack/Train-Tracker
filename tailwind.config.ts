import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        status: {
          onTime: '#34C759',
          minorDelay: '#FF9F0A',
          heavyDelay: '#FF3B30',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      spacing: {
        '0.5x': '4px',
        '1x': '8px',
        '2x': '16px',
        '3x': '24px',
        '4x': '32px',
        '6x': '48px',
      },
      borderRadius: {
        card: '20px',
        sheet: '24px',
        pill: '999px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.12)',
        card: '0 2px 12px 0 rgba(0, 0, 0, 0.08)',
      },
      backdropBlur: {
        glass: '24px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
