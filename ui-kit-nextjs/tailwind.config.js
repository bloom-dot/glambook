/** @type {import('tailwindcss').Config} */
// GlamBook — Direction artistique « Sombre Luxe »
// Thème par défaut : sombre (classe `dark` sur <html>), bascule en clair via ThemeToggle.
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Jetons sémantiques pilotés par variables CSS (globals.css) → basculent avec le thème
        bg:         'var(--bg)',
        surface:    'var(--surface)',
        'surface-2':'var(--surface-2)',
        text:       'var(--text)',
        muted:      'var(--muted)',
        border:     'var(--border)',

        // Palette de marque (fixe)
        noir:      { DEFAULT: '#0F0F11', 900: '#0F0F11', 800: '#18181B', 700: '#27272A' },
        champagne: { DEFAULT: '#D4AF37', light: '#E7C766', dark: '#B8962E' },
        poudre:    '#E8D8CE',
        rose:      { DEFAULT: '#E8547A', deep: '#C43A60' },
        fuchsia:   '#E84393',
      },
      fontFamily: {
        // Alimentés par next/font (var(--font-*)) OU par le @import de globals.css
        heading: ['var(--font-heading)', 'Cormorant Garamond', 'Playfair Display', 'serif'],
        sans:    ['var(--font-sans)', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-gold': '0 0 24px rgba(212,175,55,.35)',
        'glow-rose': '0 0 24px rgba(232,84,122,.30)',
        card:        '0 8px 30px rgba(0,0,0,.35)',
        'card-hover':'0 18px 50px rgba(0,0,0,.45)',
      },
      backgroundImage: {
        'gloss-trail': 'linear-gradient(90deg,#E8D8CE 0%,#E8547A 40%,#E84393 70%,#D4AF37 100%)',
        'champagne-sheen': 'linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent)',
      },
      keyframes: {
        'gloss-sheen': {
          '0%':   { transform: 'translateX(-20%)' },
          '100%': { transform: 'translateX(120%)' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(24px)', filter: 'blur(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)', filter: 'blur(0)' },
        },
        shimmer: {
          '0%,100%': { opacity: '.7' },
          '50%':     { opacity: '1' },
        },
      },
      animation: {
        'gloss-sheen': 'gloss-sheen 2.2s ease-in-out infinite',
        'fade-up':     'fade-up .7s cubic-bezier(.22,1,.36,1) both',
        shimmer:       'shimmer 2s ease-in-out infinite',
      },
      transitionTimingFunction: {
        organic: 'cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [],
};
