import { DESERT_DNA, TRAITS, VENT_DNA } from "../src/traits";
import type { Individual } from "./types";

export type Base = "A" | "C" | "G" | "T";

export const LOCUS_LENGTH = 9;
export const COMPLEMENT: Record<Base, Base> = { A: "T", C: "G", G: "C", T: "A" };

export type Locus = { trait: string; value: string; sequence: string };

export type Origin = "vent" | "desert" | "new" | "inherited";

export const ORIGINS: Record<Origin, { label: string; color: string }> = {
  vent: { label: "Vent founder allele", color: "#0891b2" },
  desert: { label: "Desert founder allele", color: "#ea580c" },
  new: { label: "New mutation", color: "#0d9488" },
  inherited: { label: "Inherited mutation", color: "#99f6e4" },
};

// Each allele gets a stable made-up sequence, so identical alleles align base for base.
export function alleleSequence(trait: string, value: string): string {
  let h = 2166136261;
  const text = `${trait}:${value}`;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  let sequence = "";
  for (let i = 0; i < LOCUS_LENGTH; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    sequence += "ACGT"[h >>> 30];
  }
  return sequence;
}

export function genome(dna: Record<string, string>): Locus[] {
  return TRAITS.map((trait) => ({
    trait: trait.name,
    value: dna[trait.name],
    sequence: alleleSequence(trait.name, dna[trait.name]),
  }));
}

export function alleleOrigin(creature: Pick<Individual, "dna" | "mutations">, trait: string): Origin {
  const value = creature.dna[trait];
  if (creature.mutations.includes(trait)) return "new";
  if (value === VENT_DNA[trait]) return "vent";
  if (value === DESERT_DNA[trait]) return "desert";
  return "inherited";
}

export function sequenceIdentity(a: Locus[], b: Locus[]): number {
  let same = 0;
  let total = 0;
  a.forEach((locus, i) => {
    for (let j = 0; j < LOCUS_LENGTH; j++) {
      total++;
      if (locus.sequence[j] === b[i].sequence[j]) same++;
    }
  });
  return total ? same / total : 0;
}
