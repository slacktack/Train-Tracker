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
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        status: {
          onTime: '#22C55E',
          minorDelay: '#FF8A1F',
          heavyDelay: '#F04438',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
        onAccent: 'rgb(var(--on-accent) / <alpha-value>)',
        lamp: 'rgb(var(--lamp) / <alpha-value>)',
        stamp: 'rgb(var(--stamp) / <alpha-value>)',
      },
      fontSize: {
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em', fontWeight: '600' }],
        caption: ['0.75rem', { lineHeight: '1.125rem' }],
        body: ['0.875rem', { lineHeight: '1.35rem' }],
        subhead: ['1.0625rem', { lineHeight: '1.4rem', fontWeight: '600' }],
        headline: ['1.75rem', { lineHeight: '2rem', fontWeight: '600', letterSpacing: '-0.02em' }],
        stat: ['1.0625rem', { lineHeight: '1.3rem', fontWeight: '600', letterSpacing: '-0.01em' }],
      },
      spacing: {
        '0.5x': '4px',
        '1x': '8px',
        '1.5x': '12px',
        '2x': '16px',
        '2.5x': '20px',
        '3x': '24px',
        '4x': '32px',
        '6x': '48px',
        '12x': '96px',
      },
      borderRadius: {
        card: '16px',
        sheet: '24px',
        pill: '999px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.12)',
        card: '0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 4px 16px -4px rgba(0, 0, 0, 0.08)',
        premium: '0 0 0 1px rgba(0, 0, 0, 0.04), 0 12px 32px -8px rgba(0, 0, 0, 0.14)',
      },
      backdropBlur: {
        glass: '20px',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'var(--font-devanagari)', 'system-ui', 'sans-serif'],
        display: ['var(--font-geist-sans)', 'var(--font-devanagari)', 'system-ui', 'sans-serif'],
        led: ['var(--font-led)', 'ui-monospace', 'monospace'],
        devanagari: ['var(--font-devanagari)', 'var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
