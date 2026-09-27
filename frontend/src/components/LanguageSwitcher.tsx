import { Languages } from "lucide-react";
import { LANGUAGES, useI18n } from "@/i18n";
import type { Lang } from "@/types";

export default function LanguageSwitcher({ compact = false, value, onChange }: { compact?: boolean; value?: Lang; onChange?: (l: Lang) => void }) {
  const { lang, setLang } = useI18n();
  const current = value ?? lang;
  return (
    <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-ink-300 bg-white px-3 text-sm transition-colors hover:border-ink-400 focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/20">
      <Languages size={16} className="text-ink-500" aria-hidden />
      {!compact && <span className="sr-only">Language</span>}
      <select
        aria-label="Language"
        className="cursor-pointer bg-transparent font-medium text-ink-800 focus:outline-none"
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
