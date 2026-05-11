/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          blue: '#4DBBD5',
          green: '#00A087',
        },
        text: {
          main: '#3C5488',
          secondary: '#8491B4',
        },
        status: {
          error: '#E64B35',
          warning: '#F39B7F',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
