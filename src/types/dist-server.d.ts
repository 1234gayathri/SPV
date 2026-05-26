declare module '../dist/server/server.js' {
  const server: {
    fetch: (request: Request, env?: unknown, ctx?: unknown) => Promise<Response> | Response;
    default?: any;
  };
  export default server;
}
