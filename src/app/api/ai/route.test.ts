import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { anthropicCtorMock, createMessageMock } = vi.hoisted(() => ({
  anthropicCtorMock: vi.fn(),
  createMessageMock: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    messages = {
      create: createMessageMock,
    };

    constructor(options: unknown) {
      anthropicCtorMock(options);
    }
  }

  return {
    default: Anthropic,
  };
});

import { AI_GRAPH_TOOL_NAME } from "@/lib/aiGraph";
import { POST } from "@/app/api/ai/route";

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/ai", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("POST /api/ai", () => {
  beforeEach(() => {
    anthropicCtorMock.mockReset();
    createMessageMock.mockReset();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns 400 when no messages are provided", async () => {
    const response = await POST(makeRequest({ messages: [] }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "No messages provided",
    });
    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it("returns 500 when the Anthropic API key is missing", async () => {
    const response = await POST(
      makeRequest({
        messages: [{ role: "user", content: "haz una grafica" }],
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "ANTHROPIC_API_KEY environment variable is not set",
    });
    expect(anthropicCtorMock).not.toHaveBeenCalled();
  });

  it("returns the tool summary when the model emits a graph plan", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: AI_GRAPH_TOOL_NAME,
          input: {
            summary: "Preparé el flujo solicitado.",
            nodes: [{ id: "source", type: "from" }],
            edges: [],
          },
        },
      ],
      usage: {
        input_tokens: 11,
        output_tokens: 7,
      },
    });

    const response = await POST(
      makeRequest({
        messages: [{ role: "user", content: "crea un flujo" }],
        context: {
          tables: [
            {
              name: "orders",
              columns: [{ name: "amount", type: "INTEGER" }],
            },
          ],
          nodeCount: 2,
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      reply: "Preparé el flujo solicitado.",
      plan: {
        summary: "Preparé el flujo solicitado.",
        nodes: [{ id: "source", type: "from" }],
        edges: [],
      },
      usage: {
        input_tokens: 11,
        output_tokens: 7,
      },
    });
    expect(anthropicCtorMock).toHaveBeenCalledWith({ apiKey: "test-key" });
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-sonnet-4-6",
        tool_choice: {
          type: "tool",
          name: AI_GRAPH_TOOL_NAME,
          disable_parallel_tool_use: true,
        },
      })
    );
  });

  it("falls back to the first text block when the model does not return a plan summary", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    createMessageMock.mockResolvedValue({
      content: [
        {
          type: "text",
          text: "Te recomiendo revisar la distribucion por categoria.",
        },
      ],
      usage: {
        input_tokens: 3,
        output_tokens: 5,
      },
    });

    const response = await POST(
      makeRequest({
        messages: [{ role: "user", content: "que recomiendas?" }],
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      reply: "Te recomiendo revisar la distribucion por categoria.",
      plan: null,
    });
  });
});
