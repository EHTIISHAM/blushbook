import Link from "next/link";
import { useId } from "react";

/**
 * The BooknBloom mark: a calendar whose right edge is a "B", with an
 * rose check on its face. Shape from the logo concept in design_book.jpeg.
 */
export function BrandMark({ className }: { className?: string }) {
  // A page can show the mark more than once, so each copy needs its own id.
  const gradient = `bnb-mark-${useId()}`;

  return (
    <svg
      viewBox="8 4 86 92"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C2255C" />
          <stop offset="1" stopColor="#8F1A43" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradient})`}
        d="M22 16H60C76 16 84 24 84 34C84 42 79.5 47 73 50C82 53 88 60 88 69C88 81 79 90 64 90H22C17.6 90 14 86.4 14 82V24C14 19.6 17.6 16 22 16Z"
      />
      <rect x="22" y="30" width="42" height="44" rx="5" fill="#fff" />
      <path
        fill="#fff"
        fillOpacity=".55"
        d="M14 71C32 85 58 86 84 76C68 90 38 93 14 84Z"
      />
      <path
        fill="none"
        stroke="#C2255C"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M31 52L40 61L56 41"
      />
      <rect
        x="28"
        y="7"
        width="7"
        height="17"
        rx="3.5"
        fill="#F7F6F8"
        stroke="#8F1A43"
        strokeWidth="2"
      />
      <rect
        x="47"
        y="7"
        width="7"
        height="17"
        rx="3.5"
        fill="#F7F6F8"
        stroke="#8F1A43"
        strokeWidth="2"
      />
    </svg>
  );
}

/** "BooknBloom" set as in the logo: ink "Bookn", rose "Bloom". */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-brand leading-none ${className}`}>
      Bookn<span className="text-accent">Bloom</span>
    </span>
  );
}

/** Mark plus wordmark, linking home. */
export function BrandLock({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-[10px] text-ink no-underline"
      aria-label="BooknBloom home"
    >
      <BrandMark className="h-9 w-9 flex-none" />
      <Wordmark className="text-[22px] font-medium" />
    </Link>
  );
}
