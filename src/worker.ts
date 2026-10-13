import type { Advance, Env } from "./world";

export { World } from "./world";

const REFUSALS: Record<Exclude<Advance, { ok: true }>["reason"], { status: number; message: string }> = {
  busy: { status: 409, message: "Jev is already judging the next generation. It will appear in a few seconds." },
  cooldown: { status: 429, message: "The world needs a moment between generations. Try again when the timer runs out." },
  complete: { status: 410, message: "This world has reached its 500th generation and is finished." },
  environment: { status: 400, message: "That world event doesn't exist. Pick one from the list." },
  jev: { status: 502, message: "Jev didn't answer this time, so nothing changed. Try again in a minute." },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/world")) return env.ASSETS.fetch(request);

    const world = env.WORLD.get(env.WORLD.idFromName("main"));

    if (url.pathname === "/api/world" && request.method === "GET") {
      const from = url.searchParams.get("from");
      return Response.json(await world.window(from === null ? undefined : Number(from)), {
        headers: { "cache-control": "no-store" },
      });
    }

    if (url.pathname === "/api/world/status" && request.method === "GET") {
      return Response.json(await world.status(), { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/world/advance" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { environment?: string };
      const result = await world.advance(body.environment);
      if (result.ok) return Response.json(result);
      const refusal = REFUSALS[result.reason];
      return Response.json({ ...result, message: refusal.message }, { status: refusal.status });
    }

    return Response.json({ message: "Not found" }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
