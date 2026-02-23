import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

describe("buildApp configuration", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it("sets requestTimeout and bodyLimit", async () => {
    app = buildApp();
    await app.ready();

    // @ts-expect-error - initialConfig is not typed
    expect(app.initialConfig.requestTimeout).toBe(30_000);
    expect(app.initialConfig.bodyLimit).toBe(1_048_576);
  });

  it("rejects oversized request payloads", async () => {
    app = buildApp();
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/v1/events",
      payload: { data: "x".repeat(1_200_000) },
    });

    expect(response.statusCode).toBe(413);
  });

  it("mounts debug clear route and removes public clear route", async () => {
    app = buildApp();
    await app.ready();

    const oldRouteResponse = await app.inject({
      method: "DELETE",
      url: "/v1/events",
    });

    const debugRouteValidationResponse = await app.inject({
      method: "POST",
      url: "/v1/debug/events/clear",
      payload: {},
    });

    expect(oldRouteResponse.statusCode).toBe(404);
    expect(debugRouteValidationResponse.statusCode).toBe(400);
  });
});
