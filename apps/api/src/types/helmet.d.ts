declare module 'helmet' {
  import type { RequestHandler } from 'express';
  interface HelmetOptions {
    contentSecurityPolicy?: boolean | object;
    crossOriginEmbedderPolicy?: boolean | object;
    crossOriginResourcePolicy?: boolean | object;
    [key: string]: unknown;
  }
  function helmet(options?: HelmetOptions): RequestHandler;
  export default helmet;
}
