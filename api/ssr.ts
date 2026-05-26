export const config = { runtime: "edge" };

import serverEntryModule from "@tanstack/react-start/server-entry";

const getHandler = (m: any) => m?.default ?? m;

export default async function handler(req: Request) {
  try {
    const handlerModule = getHandler(serverEntryModule);
    if (typeof handlerModule.fetch !== "function") {
      return new Response("Server entry not available", { status: 500 });
    }

    return await handlerModule.fetch(req, undefined, undefined);
  } catch (err) {
    console.error(err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
