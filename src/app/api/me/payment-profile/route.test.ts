import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User, PaymentProfile } from "@/lib/types";
import { CollabError } from "@/lib/errors";
// Mock server-only so route dependencies can be imported in Vitest.
vi.mock("server-only", () => ({}));

// Mock the session lookup, keeping the actual withUser implementation.
vi.mock("@/lib/session", () => ({
  getCurrentUser: vi.fn(),
}));

// Mock database query functions to avoid touching SQLite.
vi.mock("@/lib/queries", () => ({
  getPaymentProfile: vi.fn(),
  upsertPaymentProfile: vi.fn(),
}));

import { getCurrentUser } from "@/lib/session";
import {
  getPaymentProfile,
  upsertPaymentProfile,
} from "@/lib/queries";
import { GET, PUT } from "./route";

const testUser: User = {
  id: "usr_test123",
  username: "testuser",
  name: "Test User",
  phone: null,
  avatarColor: "#123456",
  createdAt: 1_700_000_000_000,
};

const testProfile: PaymentProfile = {
  id: "prof_test123",
  userId: testUser.id,
  preferredRail: "pocket",
  tarusProxy: null,
  tarusQrData: null,
  pocketLink: "https://example.com/pay",
  whatsappOptIn: 1,
  updatedAt: 1_700_000_000_000,
  name: testUser.name,
  username: testUser.username,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/me/payment-profile", () => {
  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Sign in to continue.",
    });

    expect(getPaymentProfile).not.toHaveBeenCalled();
  });

it("returns 500 when retrieving the profile throws an unexpected error", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(testUser);
  vi.mocked(getPaymentProfile).mockImplementation(() => {
    throw new Error("Database unavailable");
  });
   const consoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});
  const response = await GET();

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: "Database unavailable",
  });
});

it("preserves the status and message of a CollabError", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(testUser);
  vi.mocked(getPaymentProfile).mockImplementation(() => {
    throw new CollabError("Payment profile not found", 404);
  });

  const response = await GET();

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: "Payment profile not found",
  });
});

  it("returns null when the user has no payment profile", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(testUser);
  vi.mocked(getPaymentProfile).mockReturnValue(null);

  const response = await GET();

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    profile: null,
  });

  expect(getPaymentProfile).toHaveBeenCalledWith(testUser.id);
});
  it("returns the authenticated user's payment profile", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(testUser);
    vi.mocked(getPaymentProfile).mockReturnValue(testProfile);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profile: testProfile,
    });

    expect(getPaymentProfile).toHaveBeenCalledWith(testUser.id);
  });
});

describe("PUT /api/me/payment-profile", () => {
  it("returns 401 when the user is not authenticated", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/me/payment-profile",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredRail: "pocket",
        }),
      },
    );

    const response = await PUT(request);

    expect(response.status).toBe(401);
    expect(upsertPaymentProfile).not.toHaveBeenCalled();
});
 it("uses default values when the request contains malformed JSON", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(testUser);
  vi.mocked(upsertPaymentProfile).mockReturnValue({
    ...testProfile,
    preferredRail: "tarus",
    pocketLink: null,
    whatsappOptIn: 1,
  });

  const request = new Request(
    "http://localhost/api/me/payment-profile",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    },
  );

  const response = await PUT(request);

  expect(response.status).toBe(200);

  expect(upsertPaymentProfile).toHaveBeenCalledWith(testUser.id, {
    preferredRail: "tarus",
    tarusProxy: null,
    tarusQrData: null,
    pocketLink: null,
    whatsappOptIn: true,
  });
});

it("preserves WhatsApp opt-out when explicitly set to false", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(testUser);
  vi.mocked(upsertPaymentProfile).mockReturnValue({
    ...testProfile,
    whatsappOptIn: 0,
  });

  const request = new Request(
    "http://localhost/api/me/payment-profile",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whatsappOptIn: false,
      }),
    },
  );

  const response = await PUT(request);

  expect(response.status).toBe(200);

  expect(upsertPaymentProfile).toHaveBeenCalledWith(testUser.id, {
    preferredRail: "tarus",
    tarusProxy: null,
    tarusQrData: null,
    pocketLink: null,
    whatsappOptIn: false,
  });
});

it("trims whitespace from optional payment fields", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(testUser);
  vi.mocked(upsertPaymentProfile).mockReturnValue(testProfile);

  const request = new Request(
    "http://localhost/api/me/payment-profile",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tarusProxy: "  test-proxy  ",
      }),
    },
  );

  const response = await PUT(request);

  expect(response.status).toBe(200);

  expect(upsertPaymentProfile).toHaveBeenCalledWith(testUser.id, {
    preferredRail: "tarus",
    tarusProxy: "test-proxy",
    tarusQrData: null,
    pocketLink: null,
    whatsappOptIn: true,
  });
});

it("defaults to tarus when an invalid payment rail is supplied", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(testUser);
  vi.mocked(upsertPaymentProfile).mockReturnValue({
    ...testProfile,
    preferredRail: "tarus",
  });

  const request = new Request(
    "http://localhost/api/me/payment-profile",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferredRail: "bitcoin",
      }),
    },
  );

  const response = await PUT(request);

  expect(response.status).toBe(200);

  expect(upsertPaymentProfile).toHaveBeenCalledWith(testUser.id, {
    preferredRail: "tarus",
    tarusProxy: null,
    tarusQrData: null,
    pocketLink: null,
    whatsappOptIn: true,
  });
});

  it("returns 400 when the Pocket link has an invalid format", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(testUser);

    const request = new Request(
      "http://localhost/api/me/payment-profile",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredRail: "pocket",
          pocketLink: "not-a-valid-http-link",
        }),
      },
    );

    const response = await PUT(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Pocket link must start with http:// or https://",
    });

    expect(upsertPaymentProfile).not.toHaveBeenCalled();
  });

  it("saves a valid payment profile for the authenticated user", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(testUser);
    vi.mocked(upsertPaymentProfile).mockReturnValue(testProfile);

    const request = new Request(
      "http://localhost/api/me/payment-profile",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredRail: "pocket",
          tarusProxy: "test-proxy",
          pocketLink: "https://example.com/pay",
          whatsappOptIn: false,
        }),
      },
    );

    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      profile: testProfile,
    });

    expect(upsertPaymentProfile).toHaveBeenCalledWith(testUser.id, {
      preferredRail: "pocket",
      tarusProxy: "test-proxy",
      tarusQrData: null,
      pocketLink: "https://example.com/pay",
      whatsappOptIn: false,
    });
  });
});
