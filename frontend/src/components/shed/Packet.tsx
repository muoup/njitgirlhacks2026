import { type FormEvent, type ReactNode, useId } from "react";

import { cn } from "@/lib/utils";

const INK = "text-[#2b2116]";

/**
 * A seed packet: the paper form for putting something new in the ground. `onSubmit` gets
 * the fields by name, trimmed.
 */
export function Packet({
  title,
  submit,
  busy,
  error,
  onSubmit,
  onCancel,
  className,
  children,
}: {
  title: string;
  /** The submit button's words, and what it says while working. */
  submit: { label: string; busy: string };
  busy: boolean;
  error: string | null;
  onSubmit: (fields: Record<string, string>) => void;
  onCancel: () => void;
  className?: string;
  children: ReactNode;
}) {
  function submitted(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    onSubmit(Object.fromEntries([...fields].map(([name, value]) => [name, String(value).trim()])));
  }

  return (
    <form
      onSubmit={submitted}
      onKeyDown={event => event.key === "Escape" && onCancel()}
      className={cn(
        "relative -rotate-[0.4deg] bg-grove-parchment p-5 shadow-[0_8px_18px_rgb(0_0_0/0.35)] outline-[1.5px] -outline-offset-[7px] outline-[#2b2116]/30 outline-dashed",
        INK,
        className,
      )}
    >
      <p className="m-0 font-brush text-2xl leading-none">{title}</p>
      <div className="mt-3 grid gap-x-5 gap-y-3 sm:grid-flow-col sm:auto-cols-fr">{children}</div>
      {error && (
        <p role="alert" className="mt-3 mb-0 border-l-2 border-[#a3341f] pl-2 text-sm font-bold text-[#7a2413]">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm font-bold">
        <button
          type="button"
          onClick={onCancel}
          className={cn("cursor-pointer border-0 bg-transparent p-1 underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-[#2b2116]", INK)}
        >
          Never mind
        </button>
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer border-0 bg-[#14271b] px-4 py-2 text-grove-parchment outline-none hover:bg-[#1f3d2b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b2116] disabled:opacity-60"
        >
          {busy ? submit.busy : submit.label}
        </button>
      </div>
    </form>
  );
}

/** One line to fill in on a packet, written on a rule like a form on paper. Always required. */
export function PacketField({
  label,
  name,
  placeholder,
  autoFocus,
}: {
  label: string;
  name: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid min-w-0 gap-1">
      <label htmlFor={id} className="text-xs font-bold tracking-wide uppercase opacity-70">
        {label}
      </label>
      <input
        id={id}
        name={name}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        required
        // Whitespace alone is not a name.
        pattern=".*\S.*"
        maxLength={60}
        className={cn(
          "w-full min-w-0 rounded-none border-0 border-b-2 border-[#2b2116]/35 bg-transparent px-0.5 py-1 font-sans text-base outline-none placeholder:text-[#2b2116]/40 focus-visible:border-[#2b2116] focus-visible:bg-[#2b2116]/5",
          INK,
        )}
      />
    </div>
  );
}
