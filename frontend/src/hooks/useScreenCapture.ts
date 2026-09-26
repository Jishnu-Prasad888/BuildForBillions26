import { useCallback, useEffect, useRef, useState } from "react";

/* Screen capture via getDisplayMedia. The user explicitly chooses what to share.
   Frames are grabbed on demand (downscaled JPEG) and sent with a question; nothing is recorded. */
export function useScreenCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const s = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: 2 },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
      });
      s.getVideoTracks()[0].addEventListener("ended", () => setStream(null));
      setStream(s);
      return true;
    } catch (e: any) {
      setError(e?.name === "NotAllowedError" ? "Screen sharing was not allowed." : "Screen sharing is not available in this browser.");
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }, [stream]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const grabFrame = useCallback((maxWidth = 1280): string | null => {
    const v = videoRef.current;
    if (!v || !stream || !v.videoWidth) return null;
    const scale = Math.min(1, maxWidth / v.videoWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.6).split(",")[1] ?? null;
  }, [stream]);

  return { stream, active: !!stream, error, start, stop, grabFrame, videoRef };
}
