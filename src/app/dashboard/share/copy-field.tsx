"use client";

import { useEffect, useRef, useState } from "react";

export function CopyField({
  value,
  label,
  multiline = false,
}: {
  value: string;
  label: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the text is selectable either way.
      setCopied(false);
    }
  }

  return (
    <div>
      <p className="label">{label}</p>

      {multiline ? (
        <textarea
          className="field min-h-[104px] resize-y"
          value={value}
          readOnly
          onFocus={(event) => event.target.select()}
          aria-label={label}
        />
      ) : (
        <input
          className="field"
          value={value}
          readOnly
          onFocus={(event) => event.target.select()}
          aria-label={label}
        />
      )}

      <button type="button" className="btn btn-sm mt-3" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" role="status">
        {copied ? `${label} copied` : ""}
      </span>
    </div>
  );
}
