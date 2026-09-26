/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Encode Sans Semi Expanded"', '"Noto Sans Devanagari"', '"Noto Sans Kannada"', "system-ui", "sans-serif"],
        display: ['"Commissioner"', '"Noto Sans Devanagari"', '"Noto Sans Kannada"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: { DEFAULT: "#1b2b24", 900: "#111e18", 800: "#1b2b24", 700: "#2f433a", 600: "#4b6157", 500: "#65796f", 400: "#93a39b", 300: "#c3cec8", 200: "#dbe4df", 100: "#ecf2ee", 50: "#f5f8f6" },
        forest: { DEFAULT: "#0f4a37", 950: "#06231a", 900: "#0a3126", 800: "#0f4a37", 700: "#145c45", 600: "#1a7457", 500: "#23906e", 300: "#7fc4a8", 200: "#b5e0cf", 100: "#d9efe5", 50: "#eef8f3" },
        paper: { DEFAULT: "#f3f8f5", 100: "#fafcfb", 200: "#e9f1ec", 300: "#d6e2db" },
        saffron: { DEFAULT: "#2f9e6f", 50: "#eef8f3", 100: "#d3ecdf", 600: "#1f7a4d", 700: "#14573a" },
        amber: { DEFAULT: "#b7791f", 50: "#fdf8ec", 100: "#f3e2b8", 600: "#8f5f14", 700: "#6f4a0f" },
        leaf: { DEFAULT: "#1f7a4d", 50: "#ebf6f0", 100: "#d2ecdf", 600: "#19643f", 700: "#124b2f" },
        brick: { DEFAULT: "#b3372b", 50: "#fbecea", 100: "#f5d2ce" },
      },
      boxShadow: { card: "0 1px 2px rgba(15,74,55,.06), 0 1px 1px rgba(15,74,55,.04)", lift: "0 8px 24px -8px rgba(15,74,55,.16)" },
      keyframes: {
        flash: { "0%": { backgroundColor: "#d3ecdf" }, "100%": { backgroundColor: "transparent" } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(47,158,111,.45)" }, "100%": { boxShadow: "0 0 0 10px rgba(47,158,111,0)" } },
      },
      animation: { flash: "flash 1.6s ease-out", pulseRing: "pulseRing 1.4s ease-out infinite" },
    },
  },
  plugins: [],
};
