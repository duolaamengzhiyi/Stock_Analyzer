import "@testing-library/jest-dom/vitest";
import { afterEach, afterAll, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";

// 全局 MSW server，子用例可通过 server.use(...) 注入 handler
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
