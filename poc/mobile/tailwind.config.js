/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2d5016',
          light: '#4a7c2c',
          dark: '#1e3a0f',
        },
        secondary: {
          DEFAULT: '#6b4423',
          light: '#8b6243',
        },
        accent: '#d4a574',
        surface: '#ffffff',
        background: '#f5f5f0',
        temperature: '#E74C3C',
        humidity: '#3498DB',
        soil: '#27AE60',
        rain: '#9B59B6',
        success: '#28a745',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#17a2b8',
      },
    },
  },
  plugins: [],
};
