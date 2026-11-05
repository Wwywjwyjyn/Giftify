import type { Config } from 'tailwindcss';

/**
 * تم Giftify — پس‌زمینه مشکی + آبی نفتی (الگوی فرگمنت)
 * فونت: Inter برای لاتین/ارقام، Vazirmatn برای فارسی، Gulzar برای لوگوی نستعلیق
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#05080C',
        panel: '#0B111A',
        panel2: '#101926',
        line: '#1C2836',
        ink: '#F0F5FA',
        muted: '#7E90A3',
        accent: '#1691C4',
        'accent-hi': '#2CB2E0',
        'accent-deep': '#0C7A93',
        ton: '#0098EA',
        ok: '#34D399',
        bad: '#EF6A6A',
      },
      fontFamily: {
        sans: ['Inter', 'Vazirmatn', 'system-ui', '-apple-system', 'Segoe UI', 'Tahoma', 'sans-serif'],
        nasta: ['Gulzar', 'Vazirmatn', 'serif'],
      },
      borderRadius: { xl: '12px' },
      transitionTimingFunction: {
        'ui-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'ui-inout': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};
export default config;
