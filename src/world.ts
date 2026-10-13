import { DurableObject } from "cloudflare:workers";
import { ENVIRONMENTS } from "./environments";
import { breed, judgeGeneration, type Config, type Generation, type Run } from "./evolve";
import type { Creature } from "./genome";
import { Jev, type Usage } from "./jev";
import { seeded } from "./rng";

export const GENERATION_CAP = 500;
export const WINDOW = 30;
const COOLDOWN_MS = 30_000;

const CONFIG: Config = {
  seed: 42,
  foundersPerPool: 12,
  populationCap: 40,
  generations: GENERATION_CAP,
  mutationRate: 0.06,
  offspringPerPair: 4,
  mateCandidates: 3,
  minBreeders: 3,
  schedule: {},
};

type Meta = {
  count: number;
  environment: string;
  population: Creature[];
  nextId: number;
  rng: number;
  lastAdvanceAt: number;
  usage: Usage;
};

export type Env = {
  ASSETS: Fetcher;
  WORLD: DurableObjectNamespace<World>;
  JEV_API_KEY: string;
};

export type WorldStatus = {
  generations: number;
  cap: number;
  environment: string;
  advancing: boolean;
  cooldownEndsAt: number;
  usage: Usage;
};

export type Advance =
  | { ok: true; status: WorldStatus }
  | { ok: false; reason: "busy" | "cooldown" | "complete" | "environment" | "jev"; status: WorldStatus };

const generationKey = (index: number) => `gen:${index}`;

export class World extends DurableObject<Env> {
  private advancing = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(() => this.seed());
  }

  async status(): Promise<WorldStatus> {
    const meta = await this.meta();
    return {
      generations: meta.count,
      cap: GENERATION_CAP,
      environment: meta.environment,
      advancing: this.advancing,
      cooldownEndsAt: meta.lastAdvanceAt + COOLDOWN_MS,
      usage: meta.usage,
    };
  }

  async window(from?: number): Promise<Run & { world: WorldStatus; first: number }> {
    const meta = await this.meta();
    const first = Math.max(0, Math.min(from ?? meta.count - WINDOW, meta.count - 1));
    const keys = Array.from({ length: Math.min(WINDOW, meta.count - first) }, (_, i) => generationKey(first + i));
    const stored = await this.ctx.storage.get<Generation>(keys);
    const generations = keys.map((key) => stored.get(key)).filter((generation): generation is Generation => !!generation);
    return {
      config: CONFIG,
      environments: ENVIRONMENTS,
      generations,
      usage: meta.usage,
      world: await this.status(),
      first,
    };
  }

  async advance(environmentId?: string): Promise<Advance> {
    const meta = await this.meta();
    const refuse = async (reason: Exclude<Advance, { ok: true }>["reason"]): Promise<Advance> => ({
      ok: false,
      reason,
      status: await this.status(),
    });
    if (this.advancing) return refuse("busy");
    if (meta.count >= GENERATION_CAP) return refuse("complete");
    if (Date.now() < meta.lastAdvanceAt + COOLDOWN_MS) return refuse("cooldown");
    const environment = ENVIRONMENTS[environmentId ?? meta.environment];
    if (!environment) return refuse("environment");

    this.advancing = true;
    try {
      const jev = new Jev(this.env.JEV_API_KEY);
      const rng = seeded(meta.rng);
      const ids = { next: meta.nextId };
      const generation = await judgeGeneration(CONFIG, jev, rng, meta.count, environment, meta.population);
      const population = breed(CONFIG, rng, generation, ids);
      const next: Meta = {
        count: meta.count + 1,
        environment: environment.id,
        population,
        nextId: ids.next,
        rng: rng.state(),
        lastAdvanceAt: Date.now(),
        usage: {
          calls: meta.usage.calls + jev.usage.calls,
          inputTokens: meta.usage.inputTokens + jev.usage.inputTokens,
          outputTokens: meta.usage.outputTokens + jev.usage.outputTokens,
          millis: meta.usage.millis + jev.usage.millis,
        },
      };
      await this.ctx.storage.put({ [generationKey(meta.count)]: generation, meta: next });
      this.advancing = false;
      return { ok: true, status: await this.status() };
    } catch (error) {
      console.error("generation failed", error);
      this.advancing = false;
      return refuse("jev");
    }
  }

  private async meta(): Promise<Meta> {
    return (await this.ctx.storage.get<Meta>("meta"))!;
  }

  // The world continues from the published seed run, so it never starts empty.
  private async seed() {
    if (await this.ctx.storage.get<Meta>("meta")) return;

    const origin = "https://assets.local";
    const [name] = (await (await this.env.ASSETS.fetch(`${origin}/runs/index.json`)).json()) as string[];
    const run = (await (await this.env.ASSETS.fetch(`${origin}/runs/${name}`)).json()) as Run;
    const last = run.generations[run.generations.length - 1];
    const highestId = Math.max(...run.generations.flatMap((g) => g.creatures.map((c) => Number(c.id.slice(1)))));
    const rng = seeded(run.config.seed ^ 0x5eed);
    const ids = { next: highestId + 1 };
    const population = breed(CONFIG, rng, last, ids);
    const meta: Meta = {
      count: run.generations.length,
      environment: last.environment,
      population,
      nextId: ids.next,
      rng: rng.state(),
      lastAdvanceAt: 0,
      usage: run.usage,
    };
    const entries: Record<string, unknown> = { meta };
    for (const generation of run.generations) entries[generationKey(generation.index)] = generation;
    await this.ctx.storage.put(entries);
  }
}
