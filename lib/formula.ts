import katex from "katex";

type Segment = { type: "text" | "inline" | "block" | "image"; content: string };

// Splits "Find $x^2 + y^2$ when ..." into text/formula/image segments.
// $$...$$ (display/block) is matched before $...$ (inline).
// ![](url) is a pasted image, matched before both.
function parseSegments(input: string): Segment[] {
  const segments: Segment[] = [];
  const regex = /!\[\]\((.+?)\)|\$\$(.+?)\$\$|\$(.+?)\$/gs;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: input.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      segments.push({ type: "image", content: match[1] });
    } else if (match[2] !== undefined) {
      segments.push({ type: "block", content: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: "inline", content: match[3] });
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < input.length) {
    segments.push({ type: "text", content: input.slice(lastIndex) });
  }
  return segments;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Renders a mixed text+LaTeX string to an HTML string.
// Safe to use with dangerouslySetInnerHTML — plain text is escaped,
// only KaTeX's own output is trusted markup. Works server or client side.
export function renderFormulaContent(input: string): string {
  if (!input) return "";
  const segments = parseSegments(input);
  return segments
    .map((seg) => {
      if (seg.type === "text") {
        return escapeHtml(seg.content).replace(/\n/g, "<br/>");
      }
      if (seg.type === "image") {
        return `<img src="${escapeHtml(seg.content)}" style="max-width:100%;max-height:220px;display:block;margin:6px 0;border-radius:6px;" />`;
      }
      try {
        return katex.renderToString(seg.content, {
          throwOnError: false,
          displayMode: seg.type === "block",
        });
      } catch {
        return escapeHtml(seg.content);
      }
    })
    .join("");
}
