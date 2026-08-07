import { beforeEach, describe, expect, it } from "vitest";
import { createAdminToken, rateLimitKey, securePinMatches, verifyAdminToken } from "@/lib/admin-session";
import { clearPinFailures, getPinAttemptState, recordPinFailure, resetRateLimitsForTests } from "@/lib/rate-limit";

describe("management authorization", () => {
  beforeEach(() => {
    process.env.ADMIN_SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
    process.env.ADMIN_PIN = "2468";
    resetRateLimitsForTests();
  });

  it("accepts the correct server-side management code", () => expect(securePinMatches("2468")).toBe(true));
  it("rejects an incorrect management code", () => expect(securePinMatches("1111")).toBe(false));
  it("rejects non-four-digit input", () => expect(securePinMatches("18")).toBe(false));

  it("creates a valid ten-minute signed session", () => {
    const now = Date.UTC(2026, 7, 7);
    const session = verifyAdminToken(createAdminToken(now), now);
    if (!session) throw new Error("Expected a valid session");
    expect(session.exp - session.issued).toBe(600);
  });

  it("rejects a tampered session", () => {
    const token = createAdminToken();
    expect(verifyAdminToken(`${token.slice(0, -1)}x`)).toBeNull();
  });

  it("expires a session after ten minutes", () => {
    const now = Date.UTC(2026, 7, 7);
    expect(verifyAdminToken(createAdminToken(now), now + 600_001)).toBeNull();
  });

  it("locks after five failures for at least five minutes", () => {
    const now = 1_000_000;
    for (let index = 0; index < 5; index++) recordPinFailure("client", now + index);
    const state = getPinAttemptState("client", now + 5);
    expect(state.locked).toBe(true);
    expect(state.retryAfterSeconds).toBeGreaterThanOrEqual(299);
  });

  it("clears failures after a successful verification", () => {
    recordPinFailure("client"); clearPinFailures("client");
    expect(getPinAttemptState("client").failures).toBe(0);
  });

  it("hashes the client address before durable rate-limit storage", () => {
    const key = rateLimitKey("203.0.113.42");
    expect(key).toHaveLength(64);
    expect(key).not.toContain("203.0.113.42");
  });
});
