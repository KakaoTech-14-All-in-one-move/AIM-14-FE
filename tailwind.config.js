const colors = require('tailwindcss/colors')

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        kakaoYellow: '#FEE500',
        kakaoBrown: '#3B1E1E',
        discord900: '#1E1F22',
        discord800: '#232428',
        discord700: '#2B2D31',
        discord600: '#2B2D31',
        discord500: '#313339',
      }
    },
  },
  plugins: [],
};
