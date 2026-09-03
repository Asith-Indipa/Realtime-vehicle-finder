/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0b0f19",
        cardBg: "#151c2c",
        cardHover: "#1c263c",
        borderDark: "#232f48",
      },
    },
  },
  plugins: [],
}
