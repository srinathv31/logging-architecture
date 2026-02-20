declare module "pino-roll" {
  import type { Writable } from "node:stream";

  interface LimitOptions {
    count?: number;
  }

  interface Options {
    file: string | (() => string);
    frequency?: "daily" | "hourly" | number;
    size?: string | number;
    limit?: LimitOptions;
    mkdir?: boolean;
    symlink?: boolean;
    dateFormat?: string;
    extension?: string;
  }

  export default function pinoRoll(options: Options): Promise<Writable>;
}
