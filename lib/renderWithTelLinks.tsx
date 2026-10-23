import React from "react";
import { formatPhone } from "@/lib/formatPhone";

/**
 * Matches:
 *  - "911" as a standalone word (renders as tel:911)
 *  - US phone numbers in common formats:
 *      (214) 717-7944 | 214-717-7944 | 214.717.7944 | 2147177944 | +12147177944
 */
const TEL_SPLIT_REGEX =
  /(\b911\b|\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b|\b\d{10}\b)/g;

function telHref(raw: string): string {
  if (raw.trim() === "911") return "tel:911";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `tel:+${digits}`;
  return `tel:${digits}`;
}

/**
 * Render a plain-text message, turning US phone numbers and "911" into
 * tappable <a href="tel:..."> links. Safe to use on server-generated text.
 */
export function renderWithTelLinks(text: string): React.ReactNode {
  const parts = text.split(TEL_SPLIT_REGEX);
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;
        if (TEL_SPLIT_REGEX.test(part)) {
          TEL_SPLIT_REGEX.lastIndex = 0;
          const display = part.trim() === "911" ? "911" : formatPhone(part);
          return (
            <a
              key={i}
              href={telHref(part)}
              className="font-semibold underline"
              style={{ color: "inherit" }}
            >
              {display}
            </a>
          );
        }
        TEL_SPLIT_REGEX.lastIndex = 0;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
