/**
 * Renders text with **bold** markdown segments converted to <strong>.
 * Safe against XSS: each segment is rendered as a React text node.
 */
export function InlineBoldText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*\n]+?\*\*)/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        const m = part.match(/^\*\*([^*\n]+?)\*\*$/);
        if (m) return <strong key={i}>{m[1]}</strong>;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
