import { Camera, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ErrorNote, Spinner } from "@/components/ui";

/* Live camera capture through getUserMedia. The stream is stopped as soon as the modal closes or a photo is taken.
   If the browser has no camera API (or permission is denied) the caller shows a plain file input with capture="environment". */
export default function CameraCapture({ onCapture, onClose, onUnavailable }: { onCapture: (file: File) => void; onClose: () => void; onUnavailable: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return onUnavailable();
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch (e: any) {
        setError(e?.name === "NotAllowedError" ? "Camera permission was denied. Allow camera access in your browser settings, or choose a photo from your device." : "No camera could be started.");
      }
    })();
    return () => { cancelled = true; stopStream(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const take = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      stopStream();
      setShot({ url: URL.createObjectURL(b), blob: b });
    }, "image/jpeg", 0.92);
  };

  const retake = async () => {
    setShot(null);
    setReady(false);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play().catch(() => undefined); }
      setReady(true);
    } catch { setError("Couldn't restart the camera."); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" role="dialog" aria-modal aria-label="Take a photo of your form">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="font-semibold">Take a photo of your form</div>
        <button className="rounded-full p-2 hover:bg-white/10" onClick={() => { stopStream(); onClose(); }} aria-label="Close camera"><X size={22} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        {error && <div className="max-w-md"><ErrorNote>{error}</ErrorNote></div>}
        {!error && !shot && (
          <>
            <video ref={videoRef} playsInline muted className="max-h-full max-w-full rounded-lg" />
            {!ready && <div className="absolute text-white"><Spinner className="h-7 w-7" /></div>}
          </>
        )}
        {shot && <img src={shot.url} alt="Captured form" className="max-h-full max-w-full rounded-lg" />}
      </div>
      <div className="flex flex-col items-center gap-2 px-4 pb-6 pt-3 text-white">
        <p className="text-center text-sm text-white/80">Lay the form flat, fit the whole page in view and keep it well lit. No need to crop — I straighten it for you.</p>
        {!shot ? (
          <button disabled={!ready} onClick={take} className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40" aria-label="Capture photo"><Camera size={26} /></button>
        ) : (
          <div className="flex gap-3">
            <button className="btn-secondary" onClick={retake}><RefreshCw size={16} /> Retake</button>
            <button className="btn-accent" onClick={() => onCapture(new File([shot.blob], `camera-photo-${Date.now()}.jpg`, { type: "image/jpeg" }))}>Use this photo</button>
          </div>
        )}
      </div>
    </div>
  );
}
