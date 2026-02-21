import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { createEventLogDbRecord } from "../../fixtures/events";
import {
  lookupEventsRequestSchema,
  lookupEventsResponseSchema,
} from "../../../src/schemas/events";

let mockLookupEvents: (filters: {
  accountId?: string;
  processName?: string;
  eventStatus?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}) => Promise<{ events: unknown[]; totalCount: number; hasMore: boolean }>;

function buildTestApp() {
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: true });
  app.register(sensible);

  app.register(
    async (fastify) => {
      const typedApp = fastify.withTypeProvider<ZodTypeProvider>();

      typedApp.post(
        "/lookup",
        {
          schema: {
            body: lookupEventsRequestSchema,
            response: { 200: lookupEventsResponseSchema },
          },
        },
        async (request, reply) => {
          const {
            account_id,
            process_name,
            event_status,
            start_date,
            end_date,
            page,
            page_size,
          } = request.body;

          const { events, totalCount, hasMore } = await mockLookupEvents({
            accountId: account_id,
            processName: process_name,
            eventStatus: event_status,
            startDate: start_date,
            endDate: end_date,
            page,
            pageSize: page_size,
          });

          return reply.send({
            events,
            total_count: totalCount,
            page,
            page_size,
            has_more: hasMore,
          });
        },
      );
    },
    { prefix: "/v1/events" },
  );

  return app;
}

describe("POST /v1/events/lookup", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockLookupEvents = async () => ({
      events: [],
      totalCount: 0,
      hasMore: false,
    });
  });

  it("returns events with account_id filter", async () => {
    const mockEvents = [createEventLogDbRecord({ accountId: "acc-1" })];
    mockLookupEvents = async () => ({
      events: mockEvents,
      totalCount: 1,
      hasMore: false,
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/events/lookup",
      payload: {
        account_id: "acc-1",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.total_count).toBe(1);
    expect(body.events).toHaveLength(1);
    expect(body.has_more).toBe(false);
  });

  it("passes process/date/status filters to service", async () => {
    let captured:
      | {
          processName?: string;
          eventStatus?: string;
          startDate?: string;
          endDate?: string;
        }
      | null = null;
    mockLookupEvents = async (filters) => {
      captured = filters;
      return { events: [], totalCount: 0, hasMore: false };
    };

    const response = await app.inject({
      method: "POST",
      url: "/v1/events/lookup",
      payload: {
        process_name: "PAYMENT_SETTLEMENT",
        event_status: "FAILURE",
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-10T00:00:00Z",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(captured?.processName).toBe("PAYMENT_SETTLEMENT");
    expect(captured?.eventStatus).toBe("FAILURE");
    expect(captured?.startDate).toBe("2024-01-01T00:00:00Z");
    expect(captured?.endDate).toBe("2024-01-10T00:00:00Z");
  });

  it("rejects requests without account_id or process_name", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/events/lookup",
      payload: {
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-02T00:00:00Z",
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects date windows over 30 days", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/events/lookup",
      payload: {
        account_id: "acc-1",
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-02-15T00:00:00Z",
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
