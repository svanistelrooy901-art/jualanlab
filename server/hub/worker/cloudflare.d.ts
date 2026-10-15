/** The one Workers runtime module the account service uses (types kept local, like the rest of the server code). */
declare module 'cloudflare:workers' {
  export class WorkerEntrypoint<Env = unknown> {
    protected env: Env;
    protected ctx: unknown;
    constructor(ctx: unknown, env: Env);
  }
}
