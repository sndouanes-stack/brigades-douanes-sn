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
        background: "var(--background)",
        foreground: "var(--foreground)",
        kaki: {
          DEFAULT: "#4A5C2F",
          50: "#f2f4ed",
          100: "#dde3d3",
          200: "#bbc7a8",
          300: "#93a87a",
          400: "#6e8850",
          500: "#4A5C2F",
          600: "#3b4a25",
          700: "#2d381c",
          800: "#1e2613",
          900: "#0f130a",
        },
        or: {
          DEFAULT: "#C9A84C",
          50: "#fdf8ec",
          100: "#f7eccb",
          200: "#efd898",
          300: "#e4c063",
          400: "#d9ab4e",
          500: "#C9A84C",
          600: "#a8873d",
          700: "#7f662e",
          800: "#56441f",
          900: "#2b220f",
        },
      },
    },
  },
  plugins: [],
};
export default config;
