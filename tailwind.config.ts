import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#8BA89A",
          dark: "#6B8A7A",
        },
        secondary: "#C4B9A8",
        background: "#F7F5F2",
        surface: "#FFFFFF",
        "text-primary": "#2D2D2D",
        "text-secondary": "#7A7A7A",
        accent: "#A8A0C4",
        error: "#C4756A",
        border: "#E8E4DF",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
