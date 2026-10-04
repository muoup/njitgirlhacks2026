import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A question asked in place before something is thrown away. Keeping is the button in reach. */
export function Confirm({
  question,
  yes,
  onYes,
  onNo,
  className,
}: {
  question: string;
  /** The words on the button that goes ahead. */
  yes: string;
  onYes: () => void;
  onNo: () => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={question}
      onKeyDown={event => {
        if (event.key !== "Escape") return;
        // Escape answers this question only, and is not passed on to close whatever it is asked in.
        event.stopPropagation();
        onNo();
      }}
      className={cn("mt-2 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-l-2 border-grove-act pl-3 text-sm", className)}
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
