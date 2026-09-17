import Link from "next/link";

/** The Blushbook polish-drop mark, lifted from the logo kit. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="27 20 146 162"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="var(--cherry)"
        d="M100 22 C100 22 154 84 154 127 C154 161.98 123.76 180 100 180 C76.24 180 46 161.98 46 127 C46 84 100 22 100 22 Z"
      />
      <path
        fill="#fff"
        d="M75.38 123.62 L74.1 122.63 L72.6 122.01 L71 121.8 L69.4 122.01 L67.9 122.63 L66.62 123.62 L65.63 124.9 L65.01 126.4 L64.8 128 L65.01 129.6 L65.63 131.1 L66.62 132.38 L83.64 153.36 L85.08 154.54 L86.74 155.39 L88.53 155.88 L90.39 155.99 L92.23 155.72 L93.97 155.08 L95.55 154.09 L96.89 152.79 L128.99 104.67 L129.56 103.45 L129.44 102.11 L128.67 101.01 L127.45 100.44 L126.11 100.56 L125.01 101.33 L89.53 135.09 Z"
      />
      <path
        fill="var(--spark)"
        d="M44 37 Q46.4 49.6 59 52 Q46.4 54.4 44 67 Q41.6 54.4 29 52 Q41.6 49.6 44 37 Z"
      />
      <path
        fill="var(--spark)"
        d="M156 37 Q158.4 49.6 171 52 Q158.4 54.4 156 67 Q153.6 54.4 141 52 Q153.6 49.6 156 37 Z"
      />
    </svg>
  );
}

/** Mark plus wordmark, linking home. */
export function BrandLock({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-[10px] text-ink no-underline"
      aria-label="Blushbook home"
    >
      <BrandMark className="h-9 w-8 flex-none" />
      <span className="font-serif text-[25px] leading-none tracking-[0.12em]">
        BLUSHBOOK
      </span>
    </Link>
  );
}
