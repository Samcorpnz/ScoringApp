import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  priceIdForPlan,
  planForPriceId,
  priceIdForAddOn,
  addOnForPriceId,
} from "@/lib/plans";

const ENV_KEYS = [
  "STRIPE_PRICE_ID_PRO",
  "STRIPE_PRICE_ID_PRO_ANNUAL",
  "STRIPE_PRICE_ID_VENUE",
  "STRIPE_PRICE_ID_VENUE_ANNUAL",
  "STRIPE_PRICE_ID_GRAPHICS",
  "STRIPE_PRICE_ID_GRAPHICS_ANNUAL",
] as const;

describe("lib/plans", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
    process.env.STRIPE_PRICE_ID_PRO = "price_pro_month";
    process.env.STRIPE_PRICE_ID_PRO_ANNUAL = "price_pro_year";
    process.env.STRIPE_PRICE_ID_VENUE = "price_venue_month";
    process.env.STRIPE_PRICE_ID_VENUE_ANNUAL = "price_venue_year";
    process.env.STRIPE_PRICE_ID_GRAPHICS = "price_graphics_month";
    process.env.STRIPE_PRICE_ID_GRAPHICS_ANNUAL = "price_graphics_year";
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  describe("priceIdForPlan", () => {
    it("resolves the monthly price by default", () => {
      expect(priceIdForPlan("pro")).toBe("price_pro_month");
    });

    it("resolves the annual price when requested", () => {
      expect(priceIdForPlan("venue", "year")).toBe("price_venue_year");
    });

    it("throws when the env var isn't configured", () => {
      delete process.env.STRIPE_PRICE_ID_PRO;
      expect(() => priceIdForPlan("pro")).toThrow("STRIPE_PRICE_ID_PRO is not configured");
    });
  });

  describe("planForPriceId", () => {
    it("maps a pro monthly price ID back to 'pro'", () => {
      expect(planForPriceId("price_pro_month")).toBe("pro");
    });

    it("maps a pro annual price ID back to 'pro'", () => {
      expect(planForPriceId("price_pro_year")).toBe("pro");
    });

    it("maps a venue monthly price ID back to 'venue'", () => {
      expect(planForPriceId("price_venue_month")).toBe("venue");
    });

    it("maps a venue annual price ID back to 'venue'", () => {
      expect(planForPriceId("price_venue_year")).toBe("venue");
    });

    it("returns null for an unrecognized price ID", () => {
      expect(planForPriceId("price_unknown")).toBeNull();
    });
  });

  describe("priceIdForAddOn", () => {
    it("resolves the monthly add-on price by default", () => {
      expect(priceIdForAddOn("graphics-operator")).toBe("price_graphics_month");
    });

    it("resolves the annual add-on price when requested", () => {
      expect(priceIdForAddOn("graphics-operator", "year")).toBe("price_graphics_year");
    });

    it("throws when the env var isn't configured", () => {
      delete process.env.STRIPE_PRICE_ID_GRAPHICS;
      expect(() => priceIdForAddOn("graphics-operator")).toThrow(
        "STRIPE_PRICE_ID_GRAPHICS is not configured",
      );
    });
  });

  describe("addOnForPriceId", () => {
    it("maps a graphics monthly price ID back to 'graphics-operator'", () => {
      expect(addOnForPriceId("price_graphics_month")).toBe("graphics-operator");
    });

    it("maps a graphics annual price ID back to 'graphics-operator'", () => {
      expect(addOnForPriceId("price_graphics_year")).toBe("graphics-operator");
    });

    it("returns null for an unrecognized price ID", () => {
      expect(addOnForPriceId("price_unknown")).toBeNull();
    });
  });
});
