import { readdir } from "node:fs/promises";
import index from "../viewer/index.html";

const PORT = Number(process.env.PORT ?? 4173);

const server = Bun.serve({
  port: PORT,
  development: true,
  routes: {
    "/": index,
    "/runs/index.json": async () => {
      const files = (await readdir("runs")).filter((name) => name.endsWith(".json")).sort().reverse();
      return Response.json(files);
    },
    "/runs/:name": (request) => {
      const name = request.params.name;
      if (!/^[\w.-]+\.json$/.test(name)) return new Response("Not found", { status: 404 });
      return new Response(Bun.file(`runs/${name}`));
    },
  },
});

console.log(`Jev Evolution viewer at ${server.url}`);
