import type { ReactNode } from "react";

const ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** `**bold**` becomes bold; any other marks a model leaves behind are dropped. */
function inline(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) => {
    const plain = part.replace(/[*`]|^#+\s*/g, "");
    return index % 2 === 1 ? <strong key={index}>{plain}</strong> : plain;
  });
}

/**
 * What a mentor said, set as paragraphs and short lists. It reads the little formatting a
 * reply may carry (blank lines, lines starting with a dash or a number, bold) and nothing else.
 */
export function Prose({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  let open = false;
  for (const line of text.split("\n")) {
    if (!line.trim()) {
      open = false;
      continue;
    }
    const list = ITEM.test(line);
    const last = blocks.at(-1);
    if (open && last && last.list === list) last.lines.push(line);
    else blocks.push({ list, lines: [line] });
    open = true;
  }
  return blocks.map((block, index) =>
    block.list ? (
      <ul key={index} className="my-2 grid list-disc gap-1 pl-5 first:mt-0 last:mb-0">
        {block.lines.map((line, item) => (
          <li key={item}>{inline(line.replace(ITEM, ""))}</li>
        ))}
      </ul>
    ) : (
      <p key={index} className="my-2 first:mt-0 last:mb-0">
        {inline(block.lines.join(" "))}
      </p>
    ),
  );
}
