import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        border: "var(--border)",
        "card-bg": "var(--card-bg)",
        "card-hover": "var(--card-hover)",
        "badge-bg": "var(--badge-bg)",
        "badge-text": "var(--badge-text)",
        green: "rgb(var(--green) / <alpha-value>)",
        red: "var(--red)",
        "chart-green": "var(--chart-green)",
        "chart-red": "var(--chart-red)",
        accent: "rgb(var(--accent) / <alpha-value>)",
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
