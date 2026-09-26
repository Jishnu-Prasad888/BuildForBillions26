/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans"', '"Noto Sans Devanagari"', '"Noto Sans Kannada"', "system-ui", "sans-serif"],
        display: ['"Noto Serif"', '"Noto Serif Devanagari"', '"Noto Serif Kannada"', "Georgia", "serif"],
      },
      colors: {
        ink: { DEFAULT: "#14213d", 900: "#0e1729", 800: "#14213d", 700: "#223257", 600: "#34466f", 500: "#56688f", 400: "#8793ad", 300: "#b6bfd1", 200: "#dfe3ec", 100: "#eef1f6", 50: "#f6f8fb" },
        paper: { DEFAULT: "#f7f5f0", 100: "#fbfaf7", 200: "#f1eee6", 300: "#e6e1d5" },
        saffron: { DEFAULT: "#d9731a", 50: "#fdf4ea", 100: "#fbe6cf", 600: "#b85f12", 700: "#8f4a0e" },
        leaf: { DEFAULT: "#1f7a4d", 50: "#ebf6f0", 100: "#d2ecdf", 600: "#19643f", 700: "#124b2f" },
        brick: { DEFAULT: "#b3372b", 50: "#fbecea", 100: "#f5d2ce" },
      },
      boxShadow: { card: "0 1px 2px rgba(20,33,61,.06), 0 1px 1px rgba(20,33,61,.04)", lift: "0 8px 24px -8px rgba(20,33,61,.18)" },
      keyframes: {
        flash: { "0%": { backgroundColor: "#d2ecdf" }, "100%": { backgroundColor: "transparent" } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(217,115,26,.45)" }, "100%": { boxShadow: "0 0 0 10px rgba(217,115,26,0)" } },
      },
      animation: { flash: "flash 1.6s ease-out", pulseRing: "pulseRing 1.4s ease-out infinite" },
    },
  },
  plugins: [],
};
