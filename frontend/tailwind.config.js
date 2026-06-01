/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Theme-aware semantic tokens (CSS variable-driven)
        bg: 'var(--color-bg)',
        card: 'var(--color-card)',
        'card-hover': 'var(--color-card-hover)',
        surface: 'var(--color-surface)',
        stripe: 'var(--color-stripe)',
        border: 'var(--color-border)',
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          dim: 'var(--color-text-dim)',
        },
        // Opacity-modifier-enabled colors (rgba + CSS var RGB triplets)
        accent: {
          DEFAULT: 'rgba(var(--color-accent-rgb), <alpha-value>)',
          hover: 'var(--color-accent-hover)',
        },
        success: 'rgba(var(--color-success-rgb), <alpha-value>)',
        error: 'rgba(var(--color-error-rgb), <alpha-value>)',
        warning: 'rgba(var(--color-warning-rgb), <alpha-value>)',
        lime: 'rgba(var(--color-lime-rgb), <alpha-value>)',
        coral: 'rgba(var(--color-coral-rgb), <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 1.5s linear infinite',
      },
    },
  },
  plugins: [],
}
