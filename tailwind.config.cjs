/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js,ts,jsx,tsx}",
    "./index.html",
    "./src/client/index.html",
    "./src/client/**/*.{js,ts,jsx,tsx}",
    "./src/web-view/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Map to CSS variables
        'hw': {
          'bg': {
            'primary': 'var(--hw-bg-primary)',
            'secondary': 'var(--hw-bg-secondary)',
            'tertiary': 'var(--hw-bg-tertiary)',
            'elevated': 'var(--hw-bg-elevated)',
            'overlay': 'var(--hw-bg-overlay)',
          },
          'surface': {
            'primary': 'var(--hw-surface-primary)',
            'secondary': 'var(--hw-surface-secondary)',
            'tertiary': 'var(--hw-surface-tertiary)',
            'hover': 'var(--hw-surface-hover)',
            'active': 'var(--hw-surface-active)',
          },
          'text': {
            'primary': 'var(--hw-text-primary)',
            'secondary': 'var(--hw-text-secondary)',
            'tertiary': 'var(--hw-text-tertiary)',
            'muted': 'var(--hw-text-muted)',
            'disabled': 'var(--hw-text-disabled)',
          },
          'accent': {
            'primary': 'var(--hw-accent-primary)',
            'secondary': 'var(--hw-accent-secondary)',
            'tertiary': 'var(--hw-accent-tertiary)',
            'success': 'var(--hw-accent-success)',
            'warning': 'var(--hw-accent-warning)',
            'error': 'var(--hw-accent-error)',
          }
        }
      },
      fontFamily: {
        'display': 'var(--hw-font-display)',
        'body': 'var(--hw-font-body)',
        'mono': 'var(--hw-font-mono)',
      },
      spacing: {
        'xs': 'var(--hw-spacing-xs)',
        'sm': 'var(--hw-spacing-sm)',
        'md': 'var(--hw-spacing-md)',
        'lg': 'var(--hw-spacing-lg)',
        'xl': 'var(--hw-spacing-xl)',
        '2xl': 'var(--hw-spacing-2xl)',
        '3xl': 'var(--hw-spacing-3xl)',
      },
      fontSize: {
        'xs': 'var(--hw-text-xs)',
        'sm': 'var(--hw-text-sm)',
        'base': 'var(--hw-text-base)',
        'lg': 'var(--hw-text-lg)',
        'xl': 'var(--hw-text-xl)',
        '2xl': 'var(--hw-text-2xl)',
        '3xl': 'var(--hw-text-3xl)',
        '4xl': 'var(--hw-text-4xl)',
      },
      borderRadius: {
        'sm': 'var(--hw-radius-sm)',
        'md': 'var(--hw-radius-md)',
        'lg': 'var(--hw-radius-lg)',
        'xl': 'var(--hw-radius-xl)',
        '2xl': 'var(--hw-radius-2xl)',
        'full': 'var(--hw-radius-full)',
      },
      backdropBlur: {
        'xs': 'var(--hw-blur-sm)',
        'sm': 'var(--hw-blur-sm)',
        'md': 'var(--hw-blur-md)',
        'lg': 'var(--hw-blur-lg)',
        'xl': 'var(--hw-blur-xl)',
        '2xl': 'var(--hw-blur-2xl)',
      },
      boxShadow: {
        'sm': 'var(--hw-shadow-sm)',
        'md': 'var(--hw-shadow-md)',
        'lg': 'var(--hw-shadow-lg)',
        'xl': 'var(--hw-shadow-xl)',
        '2xl': 'var(--hw-shadow-2xl)',
        'glow': 'var(--hw-shadow-glow)',
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '250ms',
        'slow': '350ms',
        'slower': '500ms',
      },
      zIndex: {
        'dropdown': 'var(--hw-z-dropdown)',
        'sticky': 'var(--hw-z-sticky)',
        'fixed': 'var(--hw-z-fixed)',
        'backdrop': 'var(--hw-z-backdrop)',
        'modal': 'var(--hw-z-modal)',
        'popover': 'var(--hw-z-popover)',
        'tooltip': 'var(--hw-z-tooltip)',
        'notification': 'var(--hw-z-notification)',
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 1.5s ease-in-out infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'fade-out': 'fade-out 0.5s ease-out',
        'blur-in': 'blur-in 0.5s ease-out',
        'blur-out': 'blur-out 0.5s ease-out',
      },
      keyframes: {
        glow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'pulse-glow': {
          '0%, 100%': { 
            boxShadow: '0 0 20px var(--hw-accent-primary)',
            transform: 'scale(1)'
          },
          '50%': { 
            boxShadow: '0 0 40px var(--hw-accent-primary)',
            transform: 'scale(1.05)'
          },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-out': {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'blur-in': {
          '0%': { filter: 'blur(20px)', opacity: '0' },
          '100%': { filter: 'blur(0)', opacity: '1' },
        },
        'blur-out': {
          '0%': { filter: 'blur(0)', opacity: '1' },
          '100%': { filter: 'blur(20px)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}