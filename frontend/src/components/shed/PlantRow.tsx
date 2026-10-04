import { Check, Copy, Eye, EyeOff, KeyRound, type LucideIcon, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import type { Urgency } from "@/components/dashboard/overview";
import { PlantMushroom } from "@/components/grove/PlantMushroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyText } from "@/lib/clipboard";
import { api, type ApiKey, type Plant } from "@/lib/api";
import { useAction } from "./action";
import { Confirm } from "./Confirm";

function IconButton({ icon: Icon, label, ...props }: { icon: LucideIcon; label: string } & React.ComponentProps<typeof Button>) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} title={label} className="text-muted-foreground" {...props}>
      <Icon />
    </Button>
  );
}

/** What a name or a species has to be: something other than spaces, as when planting. */
const FIELD = { required: true, pattern: ".*\\S.*", maxLength: 60, autoComplete: "off" } as const;

/**
 * One plant in the shed, with the key its monitor uses. The key is only fetched when it is
 * shown or copied; a plant that was just planted arrives with its key already showing.
 * Its name and species can be corrected in place.
 */
export function PlantRow({
  plant,
  urgency,
  freshKey,
  onEdited,
  onRemoved,
}: {
  plant: Plant;
  urgency: Urgency | null;
  /** The key that came back from planting, if this plant was planted just now. */
  freshKey?: ApiKey;
  onEdited: (plant: Plant) => void;
  onRemoved: () => void;
}) {
  const [apiKey, setApiKey] = useState<ApiKey | null>(freshKey ?? null);
  const [shown, setShown] = useState(freshKey !== undefined);
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState<"remove" | "replace" | null>(null);
  const [editing, setEditing] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const leftEditing = useRef(false);
  const action = useAction();

  // The focus goes back to the pencil once it is there to take it, and no longer disabled by the save.
  useEffect(() => {
    if (!leftEditing.current || editing || action.busy) return;
    leftEditing.current = false;
    editButton.current?.focus();
  }, [editing, action.busy]);

  async function fetched() {
    if (apiKey) return apiKey;
    const response = await api.getPlantApiKey(plant.id);
    setApiKey(response.apiKey);
    return response.apiKey;
  }
  const show = () =>
    action.run(async () => {
      await fetched();
      setShown(true);
    });
  const copy = () =>
    action.run(async () => {
      // A key already in hand is copied without waiting, while the browser still counts the click.
      const { key } = apiKey ?? (await fetched());
      if (!(await copyText(key))) {
        setShown(true);
        throw new Error("The key couldn't be copied from this page. It's shown above: select it to copy it.");
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  function stopEditing() {
    leftEditing.current = true;
    setEditing(false);
  }
  function saved(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const name = String(fields.get("name")).trim();
    const species = String(fields.get("species")).trim();
    if (name === plant.name && species === plant.species) return stopEditing();
    action.run(async () => {
      onEdited((await api.updatePlant(plant.id, { name, species })).plant);
      stopEditing();
    });
  }
  function confirmed() {
    const what = asking;
    setAsking(null);
    action.run(async () => {
      if (what === "remove") {
        await api.removePlant(plant.id);
        onRemoved();
      } else {
        setApiKey((await api.replacePlantApiKey(plant.id)).apiKey);
        setShown(true);
      }
    });
  }
  function ask(what: "remove" | "replace") {
    action.clear();
    setAsking(what);
  }

  return (
    <li className="py-3">
      {editing ? (
        // The row gives way to the two fields, so a long species has room to be read.
        <form
          onSubmit={saved}
          onKeyDown={event => event.key === "Escape" && stopEditing()}
          className="flex items-center gap-3"
        >
          <PlantMushroom urgency={urgency} className="h-12 w-[3.3rem] shrink-0" />
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
            <Input name="name" aria-label="Name" placeholder="Name" defaultValue={plant.name} {...FIELD} autoFocus />
            <Input name="species" aria-label="Species" placeholder="Species" defaultValue={plant.species} {...FIELD} />
            <div className="flex justify-end gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={stopEditing}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="font-bold" disabled={action.busy}>
                {action.busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="flex min-w-0 items-center gap-3">
            <PlantMushroom urgency={urgency} className="h-12 w-[3.3rem] shrink-0" />
            <div className="min-w-0">
              <p className="m-0 truncate font-brush text-2xl leading-none text-grove-parchment">{plant.name}</p>
              <p className="m-0 mt-0.5 truncate text-sm text-muted-foreground italic">{plant.species}</p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-0.5 max-lg:order-last max-lg:col-span-2">
            <KeyRound aria-hidden="true" className="mr-1.5 size-4 shrink-0 text-grove-ember" />
            <code
              aria-label={shown && apiKey ? `${plant.name}'s key` : `${plant.name}'s key, hidden`}
              className="mr-1 min-w-0 flex-1 overflow-hidden bg-background/70 px-2 py-1.5 font-mono text-xs break-all lg:w-72 lg:flex-none"
            >
              {shown && apiKey ? apiKey.key : <span className="tracking-widest whitespace-nowrap text-muted-foreground">••••••••••••••••</span>}
            </code>
            {shown ? (
              <IconButton icon={EyeOff} label="Hide key" onClick={() => setShown(false)} />
            ) : (
              <IconButton icon={Eye} label="Show key" disabled={action.busy} onClick={show} />
            )}
            <IconButton icon={copied ? Check : Copy} label={copied ? "Copied" : "Copy key"} disabled={action.busy} onClick={copy} />
            <IconButton icon={RefreshCw} label="Make a new key" disabled={action.busy} onClick={() => ask("replace")} />
          </div>

          <div className="flex items-center gap-0.5">
            <IconButton
              ref={editButton}
              icon={Pencil}
              label={`Edit ${plant.name}`}
              disabled={action.busy}
              onClick={() => {
                action.clear();
                setAsking(null);
                setEditing(true);
              }}
            />
            <IconButton icon={Trash2} label={`Remove ${plant.name}`} disabled={action.busy} onClick={() => ask("remove")} />
          </div>
        </div>
      )}

      {freshKey && (
        <p className="mt-2 mb-0 text-sm text-grove-ember-hi">
          This is {plant.name}&rsquo;s key. Put it in the monitor&rsquo;s sketch so its readings land here.
        </p>
      )}
      {asking === "remove" && (
        <Confirm
          question={`Remove ${plant.name}? Its readings and its key go with it.`}
          yes="Remove"
          onYes={confirmed}
          onNo={() => setAsking(null)}
        />
      )}
      {asking === "replace" && (
        <Confirm
          question={`Make a new key for ${plant.name}? The old one stops working.`}
          yes="New key"
          onYes={confirmed}
          onNo={() => setAsking(null)}
        />
      )}
      <p role="status" className="sr-only">
        {copied ? "Key copied." : ""}
      </p>
      {action.error && (
        <p role="alert" className="mt-2 mb-0 text-sm text-grove-watch">
          {action.error}
        </p>
      )}
    </li>
  );
}
