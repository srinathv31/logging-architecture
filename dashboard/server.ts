import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { getLogger, createLogger } from "./logger.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = parseInt(process.env.PORT || "8000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Initialize logger (must happen before createLogger calls)
  await getLogger();
  const log = createLogger("server");

  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  }).listen(port, hostname, () => {
    log.info({ hostname, port }, "Next.js server ready");
  });
});
