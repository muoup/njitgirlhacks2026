import { type KeyboardEvent, useId, useState } from "react";

import { api, type Garden, type Place } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAction } from "./action";
import { Packet, PACKET_INPUT, PACKET_LABEL } from "./Packet";

const LINK = "cursor-pointer border-0 bg-transparent p-0 font-sans text-sm font-bold text-inherit underline underline-offset-4 outline-none focus-visible:outline-2 focus-visible:outline-[#2b2116] disabled:cursor-default disabled:opacity-50";

const SETTINGS: { value: Garden["setting"]; label: string; means: string }[] = [
  { value: "indoors", label: "Indoors", means: "Behind a window. Only the light and a hot or cold spell reach it." },
  { value: "outdoors", label: "Outdoors", means: "In the weather. Rain waters it, and frost and wind reach it." },
];

/**
 * The packet that says where a garden grows: the town its forecast is for, found by name,
 * and whether its plants stand in the weather. Saving with no town forgets the forecast.
 */
export function PlacePacket({ garden, className, onSaved, onCancel }: {
  garden: Garden;
  className?: string;
  onSaved: (garden: Garden) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Place[] | null>(null);
  const [chosen, setChosen] = useState<Place | null>(garden.location ?? null);
  const [setting, setSetting] = useState(garden.setting);
  const find = useAction();
  const save = useAction();
  const findable = query.trim().length >= 2 && !find.busy;

  function search() {
    if (!findable) return;
    find.run(async () => setMatches((await api.searchPlaces(query.trim())).places));
  }
  // Enter in the search line looks the town up; it should not save the packet half filled in.
  function searchOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    search();
  }

  return (
    <Packet
      title={`Where ${garden.name} grows`}
      submit={{ label: "Save", busy: "Saving…" }}
      busy={save.busy}
      error={save.error ?? find.error}
      className={className}
      onCancel={onCancel}
      onSubmit={() => save.run(async () => onSaved((await api.updateGarden(garden.id, { setting, location: chosen })).garden))}
    >
      <div className="grid min-w-0 content-start gap-2">
        <label htmlFor={id} className={PACKET_LABEL}>
          Town
        </label>
        <div className="flex items-end gap-3">
          <input
            id={id}
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={searchOnEnter}
            placeholder="Miami"
            autoComplete="off"
            autoFocus
            maxLength={100}
            className={PACKET_INPUT}
          />
          <button type="button" className={LINK} disabled={!findable} onClick={search}>
            {find.busy ? "Looking…" : "Find"}
          </button>
        </div>
        {matches &&
          (matches.length > 0 ? (
            <ul className="m-0 grid list-none gap-1 p-0">
              {matches.map(place => (
                <li key={`${place.latitude},${place.longitude}`}>
                  <button
                    type="button"
                    className={cn(LINK, "text-left font-normal no-underline hover:underline")}
                    onClick={() => {
                      setChosen(place);
                      setMatches(null);
                      setQuery("");
                    }}
                  >
                    {place.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm">No town by that name. Try a nearby one.</p>
          ))}
        <p className="m-0 text-sm" aria-live="polite">
          {chosen ? (
            <>
              Forecast for <b>{chosen.name}</b>.{" "}
              <button type="button" className={LINK} onClick={() => setChosen(null)}>
                Forget it
              </button>
            </>
          ) : (
            "No town chosen, so this garden has no forecast."
          )}
        </p>
      </div>
      <fieldset className="m-0 grid min-w-0 content-start gap-2 border-0 p-0">
        <legend className={cn(PACKET_LABEL, "mb-2 p-0")}>It stands</legend>
        {SETTINGS.map(option => (
          <label key={option.value} className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="setting"
              value={option.value}
              checked={setting === option.value}
              onChange={() => setSetting(option.value)}
              className="mt-1 accent-[#14271b]"
            />
            <span>
              <b>{option.label}</b>
              <span className="block opacity-80">{option.means}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Packet>
  );
}
