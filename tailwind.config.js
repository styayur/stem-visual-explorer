/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          light: "#f7f7f8",
          dark: "#17181b",
        },
        surface: {
          light: "#ffffff",
          dark: "#1e1f23",
        },
        edge: {
          light: "#e4e4e7",
          dark: "#2c2d31",
        },
      },
    },
  },
  plugins: [],
};