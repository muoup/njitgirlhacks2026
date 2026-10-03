import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { Urgency } from "@/components/dashboard/overview";
import { Plaque } from "@/components/dashboard/Panel";
import { Button } from "@/components/ui/button";
import { api, type ApiKey, type Garden, type Plant } from "@/lib/api";
import { useAction } from "./action";
import { Confirm } from "./Confirm";
import { Packet, PacketField } from "./Packet";
import { PlantRow } from "./PlantRow";

export interface Bed {
  garden: Garden;
  plants: Plant[];
}

/** One garden in the shed: its plants and their keys on a plaque, with a seed packet for planting another. */
export function GardenBed({
  bed: { garden, plants },
  cut,
  urgencies,
  freshKeys,
  onPlanted,
  onPlantRemoved,
  onRemoved,
}: {
  bed: Bed;
  cut: number;
  urgencies: Map<string, Urgency | null>;
  /** Keys of the plants planted since the page opened, by plant. */
  freshKeys: Record<string, ApiKey>;
  onPlanted: (plant: Plant, apiKey: ApiKey) => void;
  onPlantRemoved: (plantId: string) => void;
  onRemoved: () => void;
}) {
  const [planting, setPlanting] = useState(false);
  const [asking, setAsking] = useState(false);
  const plant = useAction();
  const remove = useAction();

  function closePacket() {
    plant.clear();
    setPlanting(false);
  }

  return (
    <Plaque cut={cut}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="m-0 truncate font-brush text-3xl leading-none font-normal">
            <Link to={`/dashboard?garden=${encodeURIComponent(garden.id)}`} className="text-grove-parchment no-underline hover:underline">
              {garden.name}
            </Link>
          </h2>
          <p className="m-0 mt-1 text-sm text-muted-foreground">
            {plants.length === 1 ? "1 plant" : `${plants.length} plants`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" className="font-bold" disabled={planting} onClick={() => setPlanting(true)}>
            <Plus />
            Plant
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            disabled={remove.busy}
            onClick={() => {
              remove.clear();
              setAsking(true);
            }}
          >
            <Trash2 />
            Remove garden
          </Button>
        </div>
      </header>

      {asking && (
        <Confirm
          question={
            plants.length === 0
              ? `Remove ${garden.name}?`
              : `Remove ${garden.name} and everything planted in it? The readings and keys go too.`
          }
          yes="Remove garden"
          onYes={() => {
            setAsking(false);
            remove.run(async () => {
              await api.removeGarden(garden.id);
              onRemoved();
            });
          }}
          onNo={() => setAsking(false)}
        />
      )}
      {remove.error && (
        <p role="alert" className="mt-2 mb-0 text-sm text-grove-watch">
          {remove.error}
        </p>
      )}

      {plants.length > 0 ? (
        <ul className="m-0 mt-2 list-none divide-y divide-border/60 p-0">
          {plants.map(item => (
            <PlantRow
              key={item.id}
              plant={item}
              urgency={urgencies.get(item.id) ?? null}
              freshKey={freshKeys[item.id]}
              onRemoved={() => onPlantRemoved(item.id)}
            />
          ))}
        </ul>
      ) : (
        !planting && <p className="mt-4 mb-1 text-sm text-muted-foreground">Nothing is planted here yet.</p>
      )}

      {planting && (
        // The packet is laid over the board and hangs a little off its edges.
        <Packet
          title={`A seed packet for ${garden.name}`}
          submit={{ label: "Plant it", busy: "Planting…" }}
          busy={plant.busy}
          error={plant.error}
          className="-mx-6 mt-3 sm:-mx-8"
          onCancel={closePacket}
          onSubmit={fields =>
            plant.run(async () => {
              const planted = await api.createPlant(garden.id, { name: fields.name!, species: fields.species! });
              onPlanted(planted.plant, planted.apiKey);
              setPlanting(false);
            })
          }
        >
          <PacketField label="Name" name="name" placeholder="Rosemary" autoFocus />
          <PacketField label="Species" name="species" placeholder="Salvia rosmarinus" />
        </Packet>
      )}
    </Plaque>
  );
}
