import { NextResponse } from "next/server";

const SPEC = {
  openapi: "3.0.3",
  info: {
    title: "NOC Manager Integration API",
    version: "1.0.0",
    description:
      "Server-to-server API for tickets, schedules, meetings, and reports. Authenticate with header X-API-Key.",
  },
  servers: [{ url: "/", description: "Current host" }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
    },
    schemas: {
      Ticket: {
        type: "object",
        properties: {
          trackingId: { type: "string" },
          title: { type: "string" },
          status: { type: "string" },
          priority: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
          ticketType: {
            type: "string",
            enum: ["Incident", "Problem", "Change", "Request"],
          },
          externalRef: { type: "string", nullable: true },
          trackUrl: { type: "string", nullable: true },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    "/api/v1/tickets": {
      get: {
        summary: "List / poll tickets",
        description:
          "Filter tickets for agents. Scope tickets:read. Use hasHumanResponse or status=Pending for staff-answered tickets.",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string" },
            description: "Single status or comma-separated list",
          },
          {
            name: "hasHumanResponse",
            in: "query",
            schema: { type: "boolean" },
            description: "Filter by firstRespondedAt set / unset",
          },
          {
            name: "createdSince",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "updatedSince",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          {
            name: "respondedSince",
            in: "query",
            schema: { type: "string", format: "date-time" },
          },
          { name: "departmentId", in: "query", schema: { type: "integer" } },
          { name: "departmentCode", in: "query", schema: { type: "string" } },
          {
            name: "includeComments",
            in: "query",
            schema: { type: "boolean" },
            description: "Embed public comments (max 50) on each ticket",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", minimum: 0, default: 0 },
          },
        ],
        responses: {
          "200": {
            description: "OK — { tickets, pagination }",
          },
        },
      },
      post: {
        summary: "Create ticket",
        parameters: [
          {
            name: "Idempotency-Key",
            in: "header",
            schema: { type: "string" },
            description: "Prevent duplicate creates from retries/alarms",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "description"],
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string" },
                  ticketType: { type: "string" },
                  departmentId: { type: "integer" },
                  departmentCode: { type: "string" },
                  externalRef: { type: "string" },
                  enableSla: { type: "boolean" },
                  slaTimerMins: { type: "integer" },
                  customData: { type: "object" },
                  serviceIds: { type: "array", items: { type: "integer" } },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Created" },
          "200": { description: "Idempotent replay" },
        },
      },
    },
    "/api/v1/tickets/{trackingId}": {
      get: {
        summary: "Get ticket by trackingId",
        parameters: [
          { name: "trackingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
      patch: {
        summary: "Update status/priority/customData",
        parameters: [
          { name: "trackingId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/tickets/{trackingId}/comments": {
      post: {
        summary: "Add comment",
        parameters: [
          { name: "trackingId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: { type: "string" },
                  isPublic: { type: "boolean", default: true },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/schedules": {
      get: {
        summary: "List shift schedules",
        description: "Scope schedules:read. Requires start and end (YYYY-MM-DD).",
        parameters: [
          { name: "start", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "end", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "departmentId", in: "query", schema: { type: "integer" } },
          { name: "locationId", in: "query", schema: { type: "integer" } },
          { name: "userId", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/schedules/types": {
      get: {
        summary: "List shift types",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/meetings": {
      get: {
        summary: "List meetings",
        parameters: [
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/meetings/{id}": {
      get: {
        summary: "Get meeting detail",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/reports/daily": {
      get: {
        summary: "List daily reports",
        parameters: [
          { name: "userId", in: "query", schema: { type: "integer" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/reports/daily/{id}": {
      get: {
        summary: "Get daily report",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { "200": { description: "OK" }, "404": { description: "Not found" } },
      },
    },
    "/api/v1/reports/ops": {
      get: {
        summary: "Ops report (downtime / new / upgrade / terminate)",
        parameters: [
          {
            name: "period",
            in: "query",
            schema: { type: "string", enum: ["week", "month", "custom"], default: "week" },
          },
          { name: "anchor", in: "query", schema: { type: "string", format: "date" } },
          { name: "start", in: "query", schema: { type: "string", format: "date" } },
          { name: "end", in: "query", schema: { type: "string", format: "date" } },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/meta/departments": {
      get: {
        summary: "List departments (id, name, code)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/external/tickets": {
      post: {
        summary: "Legacy create ticket alias",
        responses: { "201": { description: "Created" } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(SPEC);
}
