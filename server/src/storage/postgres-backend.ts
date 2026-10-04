import type { Pool, PoolClient } from "pg";
import type { BackendAdapter, BackendIdentity, InsightSnapshot } from "../backend";
import type { ApiKeyResult, DashboardData, GardensData, GardenResult, InsightsData, InsightsResult,
  PlantedResult, ReadingData, ReadingRange, ReadingsData } from "../schemas";
import type { MemoryData, MemoryWriteData, MutationData } from "../agent/schemas";
import { ApiError } from "../errors";
import { validateSample, type IngestData, type IngestResult } from "../ingestion";
import { DeviceKeys, hashKey } from "./keys";
import { transaction } from "./database";
import { DomainService } from "../domain";
import { calibrate, metricCatalogue } from "../metrics";

const iso = (value: Date | string) => new Date(value).toISOString();
const notFound = () => new ApiError(404, "NOT_FOUND", "Resource not found.");
const invalidKey = () => new ApiError(401, "INVALID_DEVICE_KEY", "A valid plant API key is required.");
const gardenSelect = `SELECT g.id, g.name,
  (SELECT count(*)::int FROM grove.plants p WHERE p.garden_id=g.id) AS "plantCount",
  (SELECT count(*)::int FROM grove.devices d JOIN grove.plants p ON p.id=d.plant_id WHERE p.garden_id=g.id) AS "deviceCount"
  FROM grove.gardens g`;
const reading = (row: any): ReadingData => calibrate({ plantId: row.plant_id, deviceId: row.device_id,
  measuredAt: iso(row.measured_at), measurements: row.measurements });

export class PostgresBackend implements BackendAdapter {
  private readonly keys: DeviceKeys;
  constructor(private readonly pool: Pool, private readonly encryptionKey: string, private readonly clock: () => number = Date.now) {
    this.keys = new DeviceKeys(encryptionKey);
  }
  private meta() { return { source: "backend" as const, hydratedAt: new Date(this.clock()).toISOString() }; }
  private async lock(client: PoolClient, accountId: string) {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`grove:${accountId}`]);
  }
  private async dirty(client: PoolClient, accountId: string, dataChanged = true) {
    await client.query(`INSERT INTO grove.agent_accounts(account_id, dirty, data_version) VALUES($1,true,$2)
      ON CONFLICT(account_id) DO UPDATE SET dirty=true, last_seen_at=now(),
      data_version=grove.agent_accounts.data_version+$2`, [accountId, dataChanged ? 1 : 0]);
  }
  async touchAccount(identity: BackendIdentity) {
    await this.pool.query(`INSERT INTO grove.agent_accounts(account_id) VALUES($1)
      ON CONFLICT(account_id) DO UPDATE SET last_seen_at=now()`, [identity.accountId]);
  }
  async listGardens(identity: BackendIdentity): Promise<GardensData> {
    return { gardens: (await this.pool.query(`${gardenSelect} WHERE g.account_id=$1 ORDER BY g.created_at,g.id`, [identity.accountId])).rows, meta: this.meta() };
  }
  async hasPlant(identity: BackendIdentity, plantId: string) {
    return Boolean((await this.pool.query(`SELECT 1 FROM grove.plants p JOIN grove.gardens g ON g.id=p.garden_id
      WHERE p.id=$1 AND g.account_id=$2`, [plantId, identity.accountId])).rowCount);
  }
  async hydrateDashboard(identity: BackendIdentity, gardenId: string): Promise<DashboardData | null> {
    const garden = (await this.pool.query(`${gardenSelect} WHERE g.id=$1 AND g.account_id=$2`, [gardenId, identity.accountId])).rows[0];
    if (!garden) return null;
    const plants = (await this.pool.query(`SELECT p.id,p.garden_id AS "gardenId",p.name,p.species FROM grove.plants p
      JOIN grove.gardens g ON g.id=p.garden_id WHERE g.id=$1 AND g.account_id=$2 ORDER BY p.created_at,p.id`, [gardenId, identity.accountId])).rows;
    const devices = (await this.pool.query(`SELECT d.id,p.garden_id AS "gardenId",d.name,d.last_seen_at FROM grove.devices d
      JOIN grove.plants p ON p.id=d.plant_id JOIN grove.gardens g ON g.id=p.garden_id
      WHERE g.id=$1 AND g.account_id=$2 ORDER BY d.id`, [gardenId, identity.accountId])).rows
      .map(row => ({ id: row.id, gardenId: row.gardenId, name: row.name, lastSeenAt: row.last_seen_at ? iso(row.last_seen_at) : null }));
    const latestReadings = (await this.pool.query(`SELECT r.* FROM grove.plants p JOIN grove.gardens g ON g.id=p.garden_id
      CROSS JOIN LATERAL (SELECT * FROM grove.sensor_readings s WHERE s.plant_id=p.id ORDER BY measured_at DESC,sample_id DESC LIMIT 1) r
      WHERE g.id=$1 AND g.account_id=$2 ORDER BY p.id`, [gardenId, identity.accountId])).rows.map(reading);
    const insights = (await this.getInsights(identity, gardenId))?.insights;
    if (!insights) return null; // Concurrent deletion.
    return { garden, plants, devices, latestReadings, insights, metrics: metricCatalogue, meta: this.meta() };
  }
  async getReadings(identity: BackendIdentity, plantId: string, range: ReadingRange): Promise<ReadingsData | null> {
    if (!await this.hasPlant(identity, plantId)) return null;
    const span = Date.parse(range.to) - Date.parse(range.from);
    if (!Number.isFinite(span) || span < 0 || span > 7 * 86400000) throw new ApiError(400, "INVALID_RANGE", "Use an ordered range of at most seven days.");
    const bucketSeconds = Math.max(60, Math.ceil(span / 1000 / 360));
    const rows = (await this.pool.query(`SELECT DISTINCT ON (date_bin(make_interval(secs => $4),r.measured_at,$2::timestamptz)) r.*
      FROM grove.sensor_readings r JOIN grove.plants p ON p.id=r.plant_id JOIN grove.gardens g ON g.id=p.garden_id
      WHERE r.plant_id=$1 AND r.measured_at >= $2 AND r.measured_at <= $3 AND g.account_id=$5
      ORDER BY date_bin(make_interval(secs => $4),r.measured_at,$2::timestamptz),r.measured_at DESC,r.sample_id DESC LIMIT 361`,
      [plantId, range.from, range.to, bucketSeconds, identity.accountId])).rows;
    return { plantId, ...range, readings: rows.map(reading), sampling: { method: "last", bucketSeconds }, meta: this.meta() };
  }
  async getInsights(identity: BackendIdentity, gardenId: string): Promise<InsightsResult | null> {
    if (!(await this.pool.query("SELECT 1 FROM grove.gardens WHERE id=$1 AND account_id=$2", [gardenId, identity.accountId])).rowCount) return null;
    const state = (await this.pool.query("SELECT * FROM grove.agent_accounts WHERE account_id=$1", [identity.accountId])).rows[0];
    const snapshot: InsightSnapshot | undefined = state?.snapshot;
    const saved = snapshot?.gardens.find(item => item.insights.gardenId === gardenId)?.insights;
    const ids = new Set((await this.pool.query("SELECT id FROM grove.plants WHERE garden_id=$1", [gardenId])).rows.map(row => row.id));
    const insights: InsightsData = saved ? { ...saved,
      items: saved.items.filter(item => item.plantId === null || ids.has(item.plantId)),
      overviews: saved.overviews?.filter(item => ids.has(item.plantId)),
      blocks: saved.blocks?.filter(block => !("plantId" in block) || !block.plantId || ids.has(block.plantId)),
    } : { gardenId, status: "unavailable", generatedAt: null, items: [] };
    const stale = state?.dirty || (snapshot && this.clock() - snapshot.generatedAt >= 3600000);
    return { insights: { ...insights, generation: { state: state?.failure ? "failed" : saved ? stale ? "stale" : "ready" : "unavailable",
      model: "gemini-3.8-flash", contextRevision: saved ? snapshot!.revision : null,
      lastAttemptAt: state?.last_attempt_at ? iso(state.last_attempt_at) : null, error: state?.failure ?? null } }, meta: this.meta() };
  }
  async readMemory(identity: BackendIdentity): Promise<MemoryData> {
    const row = (await this.pool.query("SELECT * FROM grove.memories WHERE account_id=$1", [identity.accountId])).rows[0];
    return { markdown: row?.markdown ?? "", revision: row?.revision ?? 0,
      updatedAt: row?.updated_at ? iso(row.updated_at) : null, source: "backend" };
  }
  async writeMemory(identity: BackendIdentity, input: MemoryWriteData): Promise<MemoryData> {
    if (input.markdown.length > 16384) throw new ApiError(422, "INVALID_REQUEST", "Memory is limited to 16,384 characters.");
    return transaction(this.pool, async client => {
      await this.lock(client, identity.accountId);
      await client.query("INSERT INTO grove.memories(account_id) VALUES($1) ON CONFLICT DO NOTHING", [identity.accountId]);
      const row = (await client.query(`UPDATE grove.memories SET markdown=$2,revision=revision+1,updated_at=now()
        WHERE account_id=$1 AND revision=$3 RETURNING *`, [identity.accountId, input.markdown, input.expectedRevision])).rows[0];
      if (!row) throw new ApiError(409, "MEMORY_CONFLICT", "Memory changed; read it again before updating.");
      await this.dirty(client, identity.accountId, false);
      return { markdown: row.markdown, revision: row.revision, updatedAt: iso(row.updated_at), source: "backend" };
    });
  }
  private async ownedPlant(client: Pool | PoolClient, identity: BackendIdentity, plantId: string) {
    const row = (await client.query(`SELECT p.* FROM grove.plants p JOIN grove.gardens g ON g.id=p.garden_id
      WHERE p.id=$1 AND g.account_id=$2`, [plantId, identity.accountId])).rows[0];
    if (!row) throw notFound();
    return row;
  }
  private async issueKey(client: PoolClient, plantId: string): Promise<ApiKeyResult> {
    const issued = this.keys.issue(plantId);
    const row = (await client.query(`INSERT INTO grove.device_keys(plant_id,key_hash,encrypted_key) VALUES($1,$2,$3)
      ON CONFLICT(plant_id) DO UPDATE SET key_hash=$2,encrypted_key=$3,created_at=now() RETURNING created_at`,
      [plantId, issued.hash, issued.encrypted])).rows[0];
    return { apiKey: { key: issued.key, createdAt: iso(row.created_at) } };
  }
  async getPlantApiKey(identity: BackendIdentity, plantId: string): Promise<ApiKeyResult> {
    await this.ownedPlant(this.pool, identity, plantId);
    const row = (await this.pool.query(`SELECT k.* FROM grove.device_keys k JOIN grove.plants p ON p.id=k.plant_id
      JOIN grove.gardens g ON g.id=p.garden_id WHERE p.id=$1 AND g.account_id=$2`, [plantId, identity.accountId])).rows[0];
    if (!row) throw notFound();
    return { apiKey: { key: this.keys.decrypt(row.encrypted_key, plantId), createdAt: iso(row.created_at) } };
  }
  async replacePlantApiKey(identity: BackendIdentity, plantId: string) {
    return transaction(this.pool, async client => {
      await this.lock(client, identity.accountId);
      await this.ownedPlant(client, identity, plantId);
      return this.issueKey(client, plantId);
    });
  }
  private async decodeMutation(client: Pool | PoolClient, result: any): Promise<GardenResult | PlantedResult | void> {
    if (result?.apiKey) {
      const key = this.keys.decrypt(result.apiKey.encryptedKey, result.plant.id);
      if (!(await client.query("SELECT 1 FROM grove.device_keys WHERE plant_id=$1 AND key_hash=$2", [result.plant.id, hashKey(key)])).rowCount) {
        throw new ApiError(409, "RESULT_EXPIRED", "The plant or its credential changed after this request.");
      }
      return { ...result, apiKey: { key, createdAt: result.apiKey.createdAt } };
    }
    return result ?? undefined;
  }
  async replayMutation(identity: BackendIdentity, action: MutationData, requestId: string) {
    const row = (await this.pool.query("SELECT body_hash,result FROM grove.mutations WHERE account_id=$1 AND request_id=$2", [identity.accountId, requestId])).rows[0];
    if (!row) return null;
    if (row.body_hash !== hashKey(JSON.stringify(action))) throw new ApiError(409, "REQUEST_CONFLICT", "The request ID was used for different arguments.");
    return { result: await this.decodeMutation(this.pool, row.result) };
  }
  async mutate(identity: BackendIdentity, action: MutationData, requestId: string, expectedFingerprint?: string): Promise<GardenResult | PlantedResult | void> {
    return transaction(this.pool, async client => {
      await this.lock(client, identity.accountId);
      const bodyHash = hashKey(JSON.stringify(action));
      const previous = (await client.query("SELECT * FROM grove.mutations WHERE account_id=$1 AND request_id=$2", [identity.accountId, requestId])).rows[0];
      if (previous) {
        if (previous.body_hash !== bodyHash) throw new ApiError(409, "REQUEST_CONFLICT", "The request ID was used for different arguments.");
        return this.decodeMutation(client, previous.result);
      }
      // Recheck approval targets under the same account lock as the write.
      if (expectedFingerprint !== undefined) {
        const view = new PostgresBackend(client as unknown as Pool, this.encryptionKey, this.clock);
        const target = await new DomainService(view).inspect(identity, action);
        if (target.fingerprint !== expectedFingerprint) throw new ApiError(409, "ACTION_CHANGED", "The target changed. Ask the mentor for a new proposal.");
      }
      let result: GardenResult | PlantedResult | undefined;
      if (action.kind === "createGarden") {
        if ((await client.query("SELECT count(*)::int AS count FROM grove.gardens WHERE account_id=$1", [identity.accountId])).rows[0].count >= 20) {
          throw new ApiError(429, "GARDEN_LIMIT", "At most 20 gardens are supported per account.");
        }
        const row = (await client.query("INSERT INTO grove.gardens(id,account_id,name) VALUES($1,$2,$3) RETURNING id,name",
          [crypto.randomUUID(), identity.accountId, action.name.trim()])).rows[0];
        result = { garden: { ...row, plantCount: 0, deviceCount: 0 } };
      } else if (action.kind === "removePlant") {
        await this.ownedPlant(client, identity, action.plantId);
        await client.query("DELETE FROM grove.plants WHERE id=$1", [action.plantId]);
      } else {
        if (!(await client.query("SELECT 1 FROM grove.gardens WHERE id=$1 AND account_id=$2", [action.gardenId, identity.accountId])).rowCount) throw notFound();
        if (action.kind === "removeGarden") await client.query("DELETE FROM grove.gardens WHERE id=$1 AND account_id=$2", [action.gardenId, identity.accountId]);
        else {
          if ((await client.query(`SELECT count(*)::int AS count FROM grove.plants p JOIN grove.gardens g ON g.id=p.garden_id WHERE g.account_id=$1`, [identity.accountId])).rows[0].count >= 100) {
            throw new ApiError(429, "PLANT_LIMIT", "At most 100 plants are supported per account.");
          }
          const plant = (await client.query(`INSERT INTO grove.plants(id,garden_id,name,species) VALUES($1,$2,$3,$4)
            RETURNING id,garden_id AS "gardenId",name,species`, [crypto.randomUUID(), action.gardenId, action.name.trim(), action.species.trim()])).rows[0];
          await client.query("INSERT INTO grove.devices(id,plant_id,name) VALUES($1,$2,$3)", [crypto.randomUUID(), plant.id, `${plant.name} monitor`]);
          result = { plant, ...await this.issueKey(client, plant.id) };
        }
      }
      // The retry ledger must not persist plaintext firmware credentials.
      const stored = result && "apiKey" in result ? { ...result, apiKey: {
        createdAt: result.apiKey.createdAt, encryptedKey: (await client.query("SELECT encrypted_key FROM grove.device_keys WHERE plant_id=$1", [result.plant.id])).rows[0].encrypted_key,
      } } : result;
      await client.query("INSERT INTO grove.mutations(account_id,request_id,body_hash,result) VALUES($1,$2,$3,$4)",
        [identity.accountId, requestId, bodyHash, stored ? JSON.stringify(stored) : null]);
      await this.dirty(client, identity.accountId);
      return result;
    });
  }
  async ingest(key: string, input: IngestData): Promise<IngestResult> {
    validateSample(input, this.clock());
    if (!/^grove_device_[A-Za-z0-9_-]{43}$/.test(key)) throw invalidKey();
    const lookup = `SELECT k.plant_id,d.id AS device_id,g.account_id FROM grove.device_keys k
      JOIN grove.devices d ON d.plant_id=k.plant_id JOIN grove.plants p ON p.id=k.plant_id
      JOIN grove.gardens g ON g.id=p.garden_id WHERE k.key_hash=$1`;
    const principal = (await this.pool.query(lookup, [hashKey(key)])).rows[0];
    if (!principal) throw invalidKey();
    return transaction(this.pool, async client => {
      await this.lock(client, principal.account_id);
      if (!(await client.query(lookup, [hashKey(key)])).rowCount) throw invalidKey();
      const normalized = { sampleId: input.sampleId, measuredAt: input.measuredAt ? iso(input.measuredAt) : undefined,
        measurements: input.measurements.map(({ metric, value, unit }) => ({ metric, value, unit }))
          .sort((a,b) => a.metric.localeCompare(b.metric)) };
      const bodyHash = hashKey(JSON.stringify(normalized));
      const old = (await client.query("SELECT * FROM grove.ingest_receipts WHERE device_id=$1 AND sample_id=$2", [principal.device_id, input.sampleId])).rows[0];
      if (old) {
        if (old.body_hash !== bodyHash) throw new ApiError(409, "SAMPLE_CONFLICT", "sampleId was already used for different readings.");
        return { accepted: true, duplicate: true, measuredAt: iso(old.measured_at), receivedAt: iso(old.received_at) };
      }
      const receivedAt = new Date(this.clock()).toISOString();
      const measuredAt = normalized.measuredAt ?? receivedAt;
      await client.query(`INSERT INTO grove.sensor_readings(plant_id,device_id,sample_id,measured_at,received_at,measurements)
        VALUES($1,$2,$3,$4,$5,$6)`, [principal.plant_id, principal.device_id, input.sampleId, measuredAt, receivedAt, JSON.stringify(normalized.measurements)]);
      await client.query("INSERT INTO grove.ingest_receipts(device_id,sample_id,body_hash,measured_at,received_at) VALUES($1,$2,$3,$4,$5)",
        [principal.device_id, input.sampleId, bodyHash, measuredAt, receivedAt]);
      await client.query("UPDATE grove.devices SET last_seen_at=GREATEST(last_seen_at,$2::timestamptz) WHERE id=$1", [principal.device_id, receivedAt]);
      await this.dirty(client, principal.account_id);
      return { accepted: true, duplicate: false, measuredAt, receivedAt };
    });
  }
  async readInsightSnapshot(identity: BackendIdentity): Promise<InsightSnapshot> {
    const row = (await this.pool.query("SELECT snapshot,dirty,data_version,failure FROM grove.agent_accounts WHERE account_id=$1", [identity.accountId])).rows[0];
    return { ...(row?.snapshot ?? { revision: "", generatedAt: 0, gardens: [] }), dirty: Boolean(row?.failure) || (row?.dirty ?? true), version: row?.data_version ?? 0 };
  }
  async writeInsightSnapshot(identity: BackendIdentity, snapshot: InsightSnapshot) {
    await transaction(this.pool, async client => {
      await this.lock(client, identity.accountId);
      const ids = new Set((await client.query("SELECT id FROM grove.gardens WHERE account_id=$1", [identity.accountId])).rows.map(row => row.id));
      if (snapshot.gardens.some(g => !ids.has(g.insights.gardenId))) throw new ApiError(409, "CONTEXT_CHANGED", "Gardens changed during insight generation; refresh again.");
      await client.query(`INSERT INTO grove.agent_accounts(account_id,snapshot,dirty) VALUES($1,$2,true)
        ON CONFLICT(account_id) DO UPDATE SET snapshot=$2, dirty=(grove.agent_accounts.data_version<>$3), failure=NULL`,
        [identity.accountId, JSON.stringify(snapshot), snapshot.version ?? 0]);
    });
  }
  async recordInsightAttempt(identity: BackendIdentity, at: number, error?: { code: string; message: string }) {
    await this.pool.query(`INSERT INTO grove.agent_accounts(account_id,last_attempt_at,failure) VALUES($1,$2,$3)
      ON CONFLICT(account_id) DO UPDATE SET last_attempt_at=$2,
      failure=CASE WHEN $3::jsonb IS NULL THEN grove.agent_accounts.failure ELSE $3::jsonb END`,
      [identity.accountId, new Date(at).toISOString(), error ? JSON.stringify(error) : null]);
  }
  async listAgentAccounts(): Promise<BackendIdentity[]> {
    const rows = (await this.pool.query(`SELECT a.account_id FROM grove.agent_accounts a
      WHERE a.last_seen_at>=now()-interval '24 hours' AND EXISTS(SELECT 1 FROM grove.gardens g WHERE g.account_id=a.account_id)
      AND (a.dirty OR a.failure IS NOT NULL OR a.snapshot IS NULL OR (a.snapshot->>'generatedAt')::double precision <= extract(epoch FROM now())*1000-3600000)
      ORDER BY a.last_attempt_at NULLS FIRST,a.account_id LIMIT 100`)).rows;
    return rows.map(row => ({ version: "v1", userId: row.account_id, accountId: row.account_id }));
  }
}
