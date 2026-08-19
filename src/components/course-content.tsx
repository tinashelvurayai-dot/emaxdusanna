import { Fragment } from "react";

/**
 * Tidies raw course notes: drops markdown artefacts ("#", "---" rules) and
 * normalises em dashes to a plain hyphen so notes read cleanly.
 */
export function tidyNotes(text: string): string {
  return text.replace(/\s*—\s*/g, " - ").replace(/\s*–\s*/g, " - ");
}

/** Renders **bold** inline segments within a line of text. */
function renderInline(text: string) {
  const parts = tidyNotes(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-blue-900 font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Minimal markdown-ish renderer for course module content. */
export function CourseContentBody({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flush = (key: string) => {
    if (list.length) {
      blocks.push(
        <ul key={key} className="list-disc pl-6 space-y-1 my-3 text-blue-700">
          {list.map((li, i) => <li key={i}>{renderInline(li)}</li>)}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) { flush(`ul-${idx}`); return; }
    // Horizontal rules and stray markdown rules add nothing to the notes.
    if (/^([-*_=]\s*){3,}$/.test(line)) { flush(`ul-${idx}`); return; }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      list.push(line.slice(2));
      return;
    }
    flush(`ul-${idx}`);
    // "#"-style markdown headings render as headings, never as literal "#".
    const hashHeading = line.match(/^#{1,6}\s*(.+?)\s*#*$/);
    const heading = hashHeading ?? line.match(/^\*\*(.+)\*\*:?$/);
    if (heading) {
      blocks.push(
        <h4 key={idx} className="text-lg font-bold text-blue-900 mt-5 mb-2">
          {tidyNotes(heading[1]!.replace(/\*\*/g, "").replace(/:$/, ""))}
        </h4>,
      );
    } else {
      blocks.push(<p key={idx} className="text-blue-700 leading-relaxed my-2">{renderInline(line.replace(/^#+\s*/, ""))}</p>);
    }
  });
  flush("ul-final");

  return <div>{blocks}</div>;
}