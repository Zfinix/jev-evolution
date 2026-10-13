import type { Layout } from "./layout";
import type { Run } from "./types";

export type InspectorContext = {
  run: Run;
  layout: Layout;
  a?: string;
  b?: string;
  picking: boolean;
  select(id: string, slot: "a" | "b"): void;
  clear(slot: "a" | "b"): void;
  swap(): void;
  pickSecond(): void;
  zoomTo(ids: string[]): void;
};
