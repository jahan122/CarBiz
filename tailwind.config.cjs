/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Segoe UI', 'Inter', 'system-ui', '-apple-system', 'Roboto', 'sans-serif'],
      },
      colors: {
        ink: { 900: '#0f172a', 700: '#334155', 500: '#64748b', 300: '#cbd5e1', 200: '#e2e8f0', 100: '#f1f5f9', 50: '#f8fafc' },
        brand: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#4f46e5', 600: '#4338ca', 700: '#3730a3' },
      },
    },
  },
  plugins: [],
};
