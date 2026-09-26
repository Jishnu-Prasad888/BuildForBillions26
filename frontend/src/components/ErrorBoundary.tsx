import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureError } from "@/monitoring";

const COPY: Record<string, { title: string; body: string; retry: string }> = {
  en: { title: "Something went wrong", body: "We could not show this page. Your work is safe. Please try again.", retry: "Reload the page" },
  hi: { title: "कुछ गड़बड़ हो गई", body: "यह पेज नहीं दिखाया जा सका। आपका काम सुरक्षित है। कृपया दोबारा कोशिश करें।", retry: "पेज दोबारा खोलें" },
  kn: { title: "ಏನೋ ತಪ್ಪಾಗಿದೆ", body: "ಈ ಪುಟವನ್ನು ತೋರಿಸಲು ಆಗಲಿಲ್ಲ. ನಿಮ್ಮ ಕೆಲಸ ಸುರಕ್ಷಿತವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.", retry: "ಪುಟವನ್ನು ಮತ್ತೆ ತೆರೆಯಿರಿ" },
};

/** Last-resort screen for a render crash: reports it and offers a reload instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, { componentStack: info.componentStack?.split("\n").slice(0, 12).join("\n") });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    let lang = "en";
    try { lang = localStorage.getItem("sahayak.lang") || "en"; } catch { /* storage blocked */ }
    const c = COPY[lang] ?? COPY.en;
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="max-w-md text-center">
          <h1 className="page-title">{c.title}</h1>
          <p className="mt-2 text-ink-600">{c.body}</p>
          <button className="btn-primary mt-6" onClick={() => location.reload()}>{c.retry}</button>
        </div>
      </div>
    );
  }
}
