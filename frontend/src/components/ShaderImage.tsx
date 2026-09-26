import { HalftoneDots } from "@paper-design/shaders-react";

// Decorative image rendered through a Paper Design halftone shader, drawn once (speed 0, no animation).
// Falls back to a plain <img> of `src` when WebGL is unavailable. Pass the same position/opacity/mask classes
// as for an <img>; sizing and alignment ("cover", bottom-left) are built in.
// Halftone dot size follows luminance, so a dark, low-contrast photo needs `shaderSrc`: a grayscale copy with
// its levels stretched (public/government-building-shader.webp) that the shader reads instead of `src`.

let webglOk: boolean | undefined;

function hasWebGL(): boolean {
  if (webglOk === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglOk = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      webglOk = false;
    }
    if (!webglOk) console.warn("ShaderImage: WebGL unavailable, showing the plain image instead.");
  }
  return webglOk;
}

export default function ShaderImage({ src, shaderSrc = src, className = "" }: { src: string; shaderSrc?: string; className?: string }) {
  if (!hasWebGL()) {
    return <img src={src} alt="" className={`${className} object-cover object-left-bottom`} />;
  }
  return (
    <HalftoneDots
      aria-hidden
      className={className}
      image={shaderSrc}
      fit="cover"
      originX={0}
      originY={1}
      speed={0}
      colorBack="#06231a"
      colorFront="#7fc4a8"
      size={0.22}
      radius={1}
      contrast={0.4}
      grid="hex"
      type="classic"
      grainMixer={0.05}
      grainOverlay={0.03}
    />
  );
}
