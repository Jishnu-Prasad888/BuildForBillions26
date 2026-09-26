import { Languages } from "lucide-react";
import { LANGUAGES, useI18n } from "@/i18n";
import type { Lang } from "@/types";

export default function LanguageSwitcher({ compact = false, value, onChange }: { compact?: boolean; value?: Lang; onChange?: (l: Lang) => void }) {
  const { lang, setLang } = useI18n();
  const current = value ?? lang;
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm">
      <Languages size={16} className="text-ink-500" aria-hidden />
      {!compact && <span className="sr-only">Language</span>}
      <select
        aria-label="Language"
        className="bg-transparent font-semibold text-ink-800 focus:outline-none"
        value={current}
        onChange={(e) => (onChange ?? setLang)(e.target.value as Lang)}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}
