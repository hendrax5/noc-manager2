import { NextResponse } from "next/server";

const SPEC = {
  openapi: "3.0.3",
  info: {
    title: "NOC Manager Integration API",
    version: "1.0.0",
    description:
      "Server-to-server API for creating and syncing tickets. Authenticate with header X-API-Key.",
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
