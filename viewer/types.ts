export type Individual = {
  id: string;
  generation: number;
  parents: string[];
  dna: Record<string, string>;
  ventShare: number;
  mutations: string[];
  alive: boolean;
  spared?: boolean;
  survival: { score: number; chance: number; probabilities: Record<string, number> };
  mate?: { id: string; probabilities: Record<string, number> };
  life?: {
    cause: { choice: string; confidence: number };
    strength: { choice: string; confidence: number };
    weakness: { choice: string; confidence: number };
  };
};

export type WorldStatus = {
  generations: number;
  cap: number;
  environment: string;
  advancing: boolean;
  cooldownEndsAt: number;
  usage: Run["usage"];
};

export type Run = {
  config: { seed: number };
  world?: WorldStatus;
  environments: Record<string, { id: string; name: string; description: string }>;
  generations: { index: number; environment: string; creatures: Individual[] }[];
  usage: { calls: number; inputTokens: number; outputTokens: number; millis: number };
};
