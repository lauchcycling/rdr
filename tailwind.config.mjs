/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E94F1B', // Dynamo Ruhr Orange
          hover: '#C83E12',
          subtle: '#2E150C',
        },
        surface: {
          dark: '#111111',
          card: '#1A1A1A',
          border: '#2A2A2A',
          muted: '#888888',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
