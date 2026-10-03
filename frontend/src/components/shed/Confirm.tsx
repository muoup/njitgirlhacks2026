import { Button } from "@/components/ui/button";

/** A question asked in place before something is thrown away. Keeping is the button in reach. */
export function Confirm({
  question,
  yes,
  onYes,
  onNo,
}: {
  question: string;
  /** The words on the button that goes ahead. */
  yes: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={question}
      onKeyDown={event => event.key === "Escape" && onNo()}
      className="mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-l-2 border-grove-act pl-3 text-sm"
    >
      <span className="mr-auto">{question}</span>
      <Button size="sm" variant="ghost" autoFocus onClick={onNo}>
        Keep
      </Button>
      <Button size="sm" variant="outline" className="border-grove-act text-grove-act dark:border-grove-act" onClick={onYes}>
        {yes}
      </Button>
    </div>
  );
}
