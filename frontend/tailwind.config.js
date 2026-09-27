/** @type {import('tailwindcss').Config} */
/* Google-product design tokens. Legacy palette names are kept as aliases so older
   markup restyles automatically: forest→primary blue, ink→Google grey, paper→surfaces,
   saffron→blue accent, leaf→success green, amber→warning, brick→error red. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Google Sans"', "Roboto", '"Noto Sans Devanagari"', '"Noto Sans Kannada"', "system-ui", "sans-serif"],
        display: ['"Google Sans"', "Roboto", '"Noto Sans Devanagari"', '"Noto Sans Kannada"', "system-ui", "sans-serif"],
      },
      colors: {
        /* Google grey ramp — text, borders, neutral fills */
        ink: { DEFAULT: "#1f1f1f", 900: "#1f1f1f", 800: "#303030", 700: "#444746", 600: "#5f6368", 500: "#80868b", 400: "#9aa0a6", 300: "#dadce0", 200: "#e8eaed", 100: "#f1f3f4", 50: "#f8f9fa" },
        /* Primary — Google blue */
        forest: { DEFAULT: "#0b57d0", 950: "#041e49", 900: "#0842a0", 800: "#0b57d0", 700: "#1967d2", 600: "#1a73e8", 500: "#4285f4", 300: "#7cacf8", 200: "#a8c7fa", 100: "#d3e3fd", 50: "#e8f0fe" },
        /* Surfaces */
        paper: { DEFAULT: "#f8fafd", 100: "#f8fafd", 200: "#f1f3f4", 300: "#e1e3e6" },
        /* Blue accent (progress, citations, active meta) */
        saffron: { DEFAULT: "#1a73e8", 50: "#e8f0fe", 100: "#d3e3fd", 600: "#0b57d0", 700: "#0842a0" },
        /* Success — Google green */
        leaf: { DEFAULT: "#188038", 50: "#e6f4ea", 100: "#ceead6", 600: "#1e8e3e", 700: "#0d652d" },
        /* Warning — Google yellow (dark shades for text on light) */
        amber: { DEFAULT: "#ea8600", 50: "#fef7e0", 100: "#feefc3", 600: "#e37400", 700: "#b06000" },
        /* Error — Google red */
        brick: { DEFAULT: "#d93025", 50: "#fce8e6", 100: "#fad2cf" },
      },
      boxShadow: {
        card: "0 1px 2px rgba(60,64,67,.1), 0 1px 1px rgba(60,64,67,.06)",
        lift: "0 4px 16px rgba(60,64,67,.14), 0 1px 4px rgba(60,64,67,.1)",
      },
      keyframes: {
        flash: { "0%": { backgroundColor: "#d3e3fd" }, "100%": { backgroundColor: "transparent" } },
        pulseRing: { "0%": { boxShadow: "0 0 0 0 rgba(26,115,232,.4)" }, "100%": { boxShadow: "0 0 0 10px rgba(26,115,232,0)" } },
        riseIn: { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "none" } },
        wave: { "0%,60%,100%": { transform: "rotate(0)" }, "10%,30%,50%": { transform: "rotate(16deg)" }, "20%,40%": { transform: "rotate(-10deg)" } },
        shimmer: { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        pageIn: { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        popIn: { "0%": { opacity: "0", transform: "translateY(8px) scale(.97)" }, "100%": { opacity: "1", transform: "none" } },
        sheetUp: { "0%": { transform: "translateY(100%)" }, "100%": { transform: "translateY(0)" } },
        slideInRight: { "0%": { transform: "translateX(100%)" }, "100%": { transform: "translateX(0)" } },
        skeleton: { "0%": { backgroundPosition: "100% 0" }, "100%": { backgroundPosition: "-100% 0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: {
        flash: "flash 1.6s ease-out", pulseRing: "pulseRing 1.4s ease-out infinite",
        riseIn: "riseIn .5s cubic-bezier(.2,0,0,1) backwards",
        wave: "wave 1.8s ease-in-out .5s 2 both",
        greet: "riseIn .5s cubic-bezier(.2,0,0,1) 150ms backwards, shimmer 2.4s linear 750ms 1",
        fadeIn: "fadeIn .2s ease-out backwards",
        pageIn: "pageIn .3s cubic-bezier(.2,0,0,1) backwards",
        popIn: "popIn .22s cubic-bezier(.2,0,0,1) backwards",
        sheetUp: "sheetUp .3s cubic-bezier(.2,0,0,1) both",
        slideInRight: "slideInRight .3s cubic-bezier(.2,0,0,1) both",
        skeleton: "skeleton 1.4s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
