import ShaderImage from "@/components/ShaderImage";

// One fixed, full-screen backdrop for the public and sign-in pages: the halftone building on forest green,
// kept faint, with a scrim so the text and cards above it stay readable. It does not scroll with the page.
// z-[-1] plus its later place in the DOM paints it over the app-wide body::before backdrop (index.css),
// which it fully covers here.
export default function PageBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-forest-950">
      <ShaderImage
        src="/government-building.png"
        shaderSrc="/government-building-shader.webp"
        className="absolute inset-0 h-full w-full opacity-[0.22]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-forest-950/10 via-forest-950/40 to-forest-950/75" />
    </div>
  );
}
