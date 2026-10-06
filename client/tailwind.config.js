/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', '"SF Pro Display"', '"SF Pro Text"', 'Inter', 'sans-serif'],
      },
      colors: {
        white: '#FFFFFF',
        'white-soft': '#F7F8F6',
        'green-deep': '#0B3D2E',
        'green-mid': '#1E7A4C',
        'green-soft': '#DDEFE3',
        gold: '#C9A227',
        'gold-soft': '#F4E9C9',
        'gold-deep': '#9C7A16',
        warning: '#B34700',
        'text-muted': '#6B7268',
      },
      boxShadow: {
        soft: '0 14px 35px rgba(11, 61, 46, 0.08)',
        card: '0 20px 55px rgba(11, 61, 46, 0.12)',
      },
    },
  },
  plugins: [],
};
