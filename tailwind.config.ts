import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0E1620',
        panel: '#16212E',
        panel2: '#1C2836',
        line: '#263444',
        ink: '#F1F5F8',
        muted: '#8595A6',
        accent: '#1691C4',
        'accent-hi': '#1BA6DC',
        'accent-deep': '#0C7A93',
        ton: '#0098EA',
        ok: '#4FAE4E',
        bad: '#E05252',
      },
      fontFamily: {
        sans: ['Vazirmatn', 'system-ui', '-apple-system', 'Segoe UI', 'Tahoma', 'sans-serif'],
        nasta: ['Gulzar', 'Vazirmatn', 'serif'],
      },
      borderRadius: { xl: '12px' },
    },
  },
  plugins: [],
};
export default config;
