/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        window: 'var(--window)',
        canvas: 'var(--canvas)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        danger: 'var(--danger)',
        star: 'var(--star)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-faint': 'var(--accent-faint)',
      },
      fontFamily: {
        sans: ['"Geist Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono Variable"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        caption: ['11.5px', '16px'],
        clip: ['12.5px', '19px'],
        small: ['13px', '18px'],
        body: ['14px', '20px'],
        title: ['20px', '26px'],
      },
    },
  },
  plugins: [],
};
