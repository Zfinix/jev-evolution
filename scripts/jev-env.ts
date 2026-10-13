import { Jev } from "../src/jev";

export function jevFromEnv(): Jev {
  const key = process.env.JEV_API_KEY ?? process.env.ASTER_JEV_API_KEY;
  if (!key) throw new Error("Set JEV_API_KEY (or ASTER_JEV_API_KEY) to run the simulation.");
  return new Jev(key);
}
