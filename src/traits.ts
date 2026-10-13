export type Trait = { name: string; options: string[] };

export const TRAITS: Trait[] = [
  { name: "covering", options: ["soft skin", "slime coat", "fur", "feathers", "scales", "bony armor plates"] },
  { name: "size", options: ["tiny", "small", "medium", "large", "huge"] },
  { name: "metabolism", options: ["very slow", "slow", "moderate", "fast", "very fast"] },
  { name: "temperature", options: ["cold-adapted", "cool-tolerant", "neutral", "heat-tolerant", "heat-loving"] },
  { name: "water", options: ["fully aquatic", "needs constant moisture", "moderate", "drought-tolerant", "almost no water"] },
  { name: "light", options: ["bioluminescent", "dark-dwelling", "active at dusk", "active by day", "sun-basking"] },
  { name: "locomotion", options: ["drifting", "swimming", "crawling", "running", "climbing", "gliding"] },
  { name: "speed", options: ["sluggish", "slow", "average", "quick", "sprinter"] },
  { name: "diet", options: ["filter feeder", "vent chemical grazer", "scavenger", "herbivore", "insectivore", "predator"] },
  { name: "social", options: ["hive", "communal", "small groups", "pairs", "solitary"] },
  { name: "senses", options: ["pressure sensing", "electroreception", "smell", "hearing", "keen eyesight"] },
  { name: "defense", options: ["toxins", "camouflage", "shell retreat", "spines", "escape by speed", "bite"] },
  { name: "reproduction", options: ["thousands of eggs", "many eggs", "few eggs", "live birth of one young"] },
  { name: "lifespan", options: ["weeks", "months", "a few years", "decades"] },
  { name: "limbs", options: ["none", "tentacles", "many small legs", "four legs", "two legs and wings"] },
  { name: "intelligence", options: ["instinct only", "simple learning", "problem solver", "tool user"] },
];

export type Dna = Record<string, string>;

export const VENT_DNA: Dna = {
  covering: "slime coat",
  size: "medium",
  metabolism: "very slow",
  temperature: "cold-adapted",
  water: "fully aquatic",
  light: "bioluminescent",
  locomotion: "drifting",
  speed: "sluggish",
  diet: "vent chemical grazer",
  social: "hive",
  senses: "electroreception",
  defense: "toxins",
  reproduction: "thousands of eggs",
  lifespan: "decades",
  limbs: "tentacles",
  intelligence: "simple learning",
};

export const DESERT_DNA: Dna = {
  covering: "bony armor plates",
  size: "small",
  metabolism: "fast",
  temperature: "heat-loving",
  water: "almost no water",
  light: "sun-basking",
  locomotion: "climbing",
  speed: "sprinter",
  diet: "predator",
  social: "solitary",
  senses: "keen eyesight",
  defense: "spines",
  reproduction: "few eggs",
  lifespan: "a few years",
  limbs: "four legs",
  intelligence: "problem solver",
};
