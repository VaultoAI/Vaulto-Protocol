/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Vaulto brand colors
        vaulto: {
          primary: "#6366f1", // Indigo
          secondary: "#8b5cf6", // Violet
          accent: "#22d3ee", // Cyan
          background: "#0f0f23",
          surface: "#1a1a2e",
          border: "#2a2a4a",
        },
      },
    },
  },
  plugins: [],
};
