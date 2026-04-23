/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    './types/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'dark-base': '#121212',
        'dark-card': '#1a1a1a',
        'dark-border': 'rgba(255, 255, 255, 0.1)',
        'eco-green': '#00eaaf',
        'eco-green-dark': '#00846c',
        'eco-green-med': '#00c49a',
        'eco-green-bright': '#00eaaf',
        cyan: '#00D9FF',
        'electric-blue': '#0080FF',
      },
    },
  },
  plugins: [],
};

