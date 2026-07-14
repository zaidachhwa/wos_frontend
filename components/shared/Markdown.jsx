"use client";

import ReactMarkdown from "react-markdown";

// Tailwind preflight strips default list/heading styling, so restore just
// enough for AI-generated markdown (bold, lists, headings) to read cleanly.
const components = {
  p: (props) => <p className="mb-2 last:mb-0" {...props} />,
  ul: (props) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0" {...props} />,
  ol: (props) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0" {...props} />,
  li: (props) => <li {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  h1: (props) => <h3 className="mb-1 mt-3 font-semibold first:mt-0" {...props} />,
  h2: (props) => <h3 className="mb-1 mt-3 font-semibold first:mt-0" {...props} />,
  h3: (props) => <h3 className="mb-1 mt-3 font-semibold first:mt-0" {...props} />,
  code: (props) => <code className="rounded bg-border/60 px-1 py-0.5 text-xs" {...props} />,
};

export default function Markdown({ text, className = "" }) {
  return (
    <div className={`text-sm ${className}`}>
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
    </div>
  );
}
