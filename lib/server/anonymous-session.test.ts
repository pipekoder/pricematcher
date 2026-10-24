import { describe, expect, it } from "vitest";
import { createAnonymousSession, verifyAnonymousSession } from "./anonymous-session";

describe("server-issued anonymous sessions", () => {
  it("accepts a valid signed token", () => { const session = createAnonymousSession(); expect(verifyAnonymousSession(session.token)).toBe(session.id); });
  it("rejects client-invented and tampered tokens", () => { const session = createAnonymousSession(); expect(verifyAnonymousSession(crypto.randomUUID())).toBeNull(); expect(verifyAnonymousSession(`${session.id}.invalid`)).toBeNull(); expect(verifyAnonymousSession(`${crypto.randomUUID()}.${session.token.split(".")[1]}`)).toBeNull(); });
});
