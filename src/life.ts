import { describe, type Creature } from "./genome";
import type { Environment } from "./environments";
import type { Jev, Question } from "./jev";
import { TRAITS } from "./traits";

const BATCH = 8;

export const CAUSES: Record<string, string> = {
  cold: "freezing or cold exposure",
  heat: "overheating",
  thirst: "dehydration",
  starvation: "starvation, unable to find food it can eat",
  predators: "killed by predators",
  habitat: "unable to move, breathe or function in this habitat",
  frailty: "weakness or old age",
};

type Pick = { choice: string; confidence: number };

export type Life = { cause: Pick; strength: Pick; weakness: Pick };

function traitCriteria(creature: Creature): Record<string, string> {
  return Object.fromEntries(TRAITS.map((trait) => [trait.name, `${trait.name}: ${creature.dna[trait.name]}`]));
}

export async function judgeLives(
  jev: Jev,
  environment: Environment,
  creatures: Creature[],
): Promise<Map<string, Life>> {
  const batches: Creature[][] = [];
  for (let i = 0; i < creatures.length; i += BATCH) batches.push(creatures.slice(i, i + BATCH));

  const lives = new Map<string, Life>();
  await Promise.all(
    batches.map(async (batch) => {
      const state = [
        `Environment: ${environment.name}. ${environment.description}`,
        "Creatures:",
        ...batch.map(describe),
      ].join("\n");
      const questions: Record<string, Question> = {};
      for (const creature of batch) {
        questions[`${creature.id}.cause`] = {
          type: "choice",
          instructions: `If creature ${creature.id} dies in this environment, what most likely kills it?`,
          criteria: CAUSES,
        };
        questions[`${creature.id}.strength`] = {
          type: "choice",
          instructions: `Which single trait of creature ${creature.id} helps it most to survive in this environment?`,
          criteria: traitCriteria(creature),
        };
        questions[`${creature.id}.weakness`] = {
          type: "choice",
          instructions: `Which single trait of creature ${creature.id} hurts its survival most in this environment?`,
          criteria: traitCriteria(creature),
        };
      }
      const answers = await jev.evaluate(state, questions);
      const pick = (key: string): Pick => {
        const answer = answers[key];
        if (answer?.type !== "choice") throw new Error(`No choice answer for ${key}`);
        return { choice: answer.choice, confidence: answer.probabilities[answer.choice] ?? answer.confidence };
      };
      for (const creature of batch) {
        lives.set(creature.id, {
          cause: pick(`${creature.id}.cause`),
          strength: pick(`${creature.id}.strength`),
          weakness: pick(`${creature.id}.weakness`),
        });
      }
    }),
  );
  return lives;
}
