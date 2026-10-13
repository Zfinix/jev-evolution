import { describe, type Creature } from "./genome";
import type { Environment } from "./environments";
import type { Jev, Question } from "./jev";

const BATCH = 8;
const SURVIVAL_SCALE = ["dies within a season", "struggles to survive", "survives", "thrives"];

export type Survival = {
  score: number;
  // Chance of living to breed, read off Jev's probabilities for each outcome.
  chance: number;
  probabilities: Record<string, number>;
};

export async function judgeSurvival(
  jev: Jev,
  environment: Environment,
  creatures: Creature[],
): Promise<Map<string, Survival>> {
  const batches: Creature[][] = [];
  for (let i = 0; i < creatures.length; i += BATCH) batches.push(creatures.slice(i, i + BATCH));

  const results = new Map<string, Survival>();
  await Promise.all(
    batches.map(async (batch) => {
      const state = [
        `Environment: ${environment.name}. ${environment.description}`,
        "Creatures:",
        ...batch.map(describe),
      ].join("\n");
      const questions: Record<string, Question> = {};
      for (const creature of batch) {
        questions[creature.id] = {
          type: "score",
          instructions: `How well does creature ${creature.id} survive in this environment, judged only by its own traits?`,
          criteria: SURVIVAL_SCALE,
        };
      }
      const answers = await jev.evaluate(state, questions);
      for (const creature of batch) {
        const answer = answers[creature.id];
        if (answer?.type !== "score") throw new Error(`No survival score for ${creature.id}`);
        const p = answer.probabilities;
        results.set(creature.id, {
          score: answer.score,
          chance: (p["1"] ?? 0) * 0.35 + (p["2"] ?? 0) * 0.8 + (p["3"] ?? 0),
          probabilities: p,
        });
      }
    }),
  );
  return results;
}

export async function chooseMates(
  jev: Jev,
  environment: Environment,
  survivors: Creature[],
  candidateCount: number,
  pick: <T>(items: T[]) => T,
): Promise<Map<string, { mate: string; probabilities: Record<string, number> }>> {
  const byId = new Map(survivors.map((creature) => [creature.id, creature]));
  const chunks: Creature[][] = [];
  for (let i = 0; i < survivors.length; i += BATCH) chunks.push(survivors.slice(i, i + BATCH));

  const results = new Map<string, { mate: string; probabilities: Record<string, number> }>();
  await Promise.all(
    chunks.map(async (chunk) => {
      const questions: Record<string, Question> = {};
      const involved = new Set<string>();
      for (const chooser of chunk) {
        const pool = survivors.filter((other) => other.id !== chooser.id);
        const candidates: Creature[] = [];
        while (candidates.length < Math.min(candidateCount, pool.length)) {
          const candidate = pick(pool);
          if (!candidates.includes(candidate)) candidates.push(candidate);
        }
        if (candidates.length === 0) continue;
        involved.add(chooser.id);
        for (const candidate of candidates) involved.add(candidate.id);
        questions[chooser.id] = {
          type: "choice",
          instructions: `Creature ${chooser.id} is choosing a mate. Which partner gives offspring the best chance of surviving this environment?`,
          criteria: Object.fromEntries(candidates.map((c) => [c.id, `mate with ${c.id}`])),
        };
      }
      if (Object.keys(questions).length === 0) return;
      const state = [
        `Environment: ${environment.name}. ${environment.description}`,
        "Creatures:",
        ...[...involved].map((id) => describe(byId.get(id)!)),
      ].join("\n");
      const answers = await jev.evaluate(state, questions);
      for (const [id, answer] of Object.entries(answers)) {
        if (answer.type !== "choice") continue;
        results.set(id, { mate: answer.choice, probabilities: answer.probabilities });
      }
    }),
  );
  return results;
}
