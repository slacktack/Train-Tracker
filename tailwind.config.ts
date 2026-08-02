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
          onTime: '#22C55E',
          minorDelay: '#F59E0B',
          heavyDelay: '#EF4444',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      fontSize: {
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.03em', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1rem' }],
        body: ['0.875rem', { lineHeight: '1.25rem' }],
        subhead: ['1.0625rem', { lineHeight: '1.375rem', fontWeight: '600' }],
        headline: ['1.75rem', { lineHeight: '2rem', fontWeight: '600' }],
        stat: ['1.0625rem', { lineHeight: '1.25rem', fontWeight: '600' }],
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
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        devanagari: ['var(--font-devanagari)', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
