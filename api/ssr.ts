export const config = { runtime: "edge" };

import server from "../dist/server/server.js";

export default async function handler(req: Request) {
  try {
    if (!server || typeof server.fetch !== "function") {
      return new Response("Server entry not available", { status: 500 });
    }

    return await server.fetch(req, undefined, undefined);
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
