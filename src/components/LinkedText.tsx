import React from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"')\]]+)/g;

/**
 * Renders plain text (course descriptions, session notes) with every http(s) link turned into
 * a clickable anchor. Text that contains no link renders exactly as before.
 */
export default function LinkedText({ text, className }: { text?: string | null; className?: string }) {
  const value = String(text ?? "");
  if (!value) return null;

  const parts = value.split(URL_PATTERN);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (index % 2 === 0) return <React.Fragment key={index}>{part}</React.Fragment>;
        // Trailing punctuation belongs to the sentence, not to the link.
        const trailing = part.match(/[.,;:!?]+$/)?.[0] || "";
        const href = trailing ? part.slice(0, -trailing.length) : part;
        return (
          <React.Fragment key={index}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-300 hover:text-indigo-200 underline underline-offset-2 break-all transition"
            >
              {href}
            </a>
            {trailing}
          </React.Fragment>
        );
      })}
    </span>
  );
}
