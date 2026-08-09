// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendMock = vi.fn();
vi.mock("mailgun.js", () => ({
  default: class {
    client() {
      return { messages: { create: (...a: unknown[]) => sendMock(...a) } };
    }
  },
}));
vi.mock("form-data", () => ({ default: class {} }));

describe("lib/email", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as unknown as { mailgun?: unknown }).mailgun;
    sendMock.mockReset();
    sendMock.mockResolvedValue({ id: "email_1", message: "Queued. Thank you." });
    process.env.MAILGUN_API_KEY = "key-test";
    process.env.MAILGUN_DOMAIN = "sandboxtest.mailgun.org";
    process.env.EMAIL_FROM = "ScoreHub <noreply@scorehub.test>";
    process.env.NEXTAUTH_URL = "https://app.scorehub.test";
  });

  describe("sendEmailChangeVerification", () => {
    it("sends with a verify-email link containing the token", async () => {
      const { sendEmailChangeVerification } = await import("../email");
      await sendEmailChangeVerification({ to: "user@example.com", token: "tok123" });
      expect(sendMock).toHaveBeenCalledWith(
        "sandboxtest.mailgun.org",
        expect.objectContaining({
          from: "ScoreHub <noreply@scorehub.test>",
          to: "user@example.com",
          subject: expect.stringContaining("Confirm"),
          text: expect.stringContaining("https://app.scorehub.test/verify-email?token=tok123"),
          html: expect.stringContaining("https://app.scorehub.test/verify-email?token=tok123"),
        }),
      );
    });

    it("falls back to localhost when NEXTAUTH_URL is unset", async () => {
      delete process.env.NEXTAUTH_URL;
      const { sendEmailChangeVerification } = await import("../email");
      await sendEmailChangeVerification({ to: "user@example.com", token: "tok123" });
      expect(sendMock).toHaveBeenCalledWith(
        "sandboxtest.mailgun.org",
        expect.objectContaining({
          text: expect.stringContaining("http://localhost:3000/verify-email?token=tok123"),
        }),
      );
    });

    it("throws when EMAIL_FROM is not configured", async () => {
      delete process.env.EMAIL_FROM;
      const { sendEmailChangeVerification } = await import("../email");
      await expect(
        sendEmailChangeVerification({ to: "user@example.com", token: "tok123" }),
      ).rejects.toThrow("EMAIL_FROM is not configured");
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("throws when MAILGUN_API_KEY is not configured", async () => {
      delete process.env.MAILGUN_API_KEY;
      const { sendEmailChangeVerification } = await import("../email");
      await expect(
        sendEmailChangeVerification({ to: "user@example.com", token: "tok123" }),
      ).rejects.toThrow("MAILGUN_API_KEY is not configured");
    });

    it("throws when MAILGUN_DOMAIN is not configured", async () => {
      delete process.env.MAILGUN_DOMAIN;
      const { sendEmailChangeVerification } = await import("../email");
      await expect(
        sendEmailChangeVerification({ to: "user@example.com", token: "tok123" }),
      ).rejects.toThrow("MAILGUN_DOMAIN is not configured");
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe("sendInvitationEmail", () => {
    it("sends with an invite/accept link and role/org name in the copy", async () => {
      const { sendInvitationEmail } = await import("../email");
      await sendInvitationEmail({
        to: "invitee@example.com",
        orgName: "Wellington Netball",
        role: "OPERATOR",
        token: "inv-tok",
      });
      expect(sendMock).toHaveBeenCalledWith(
        "sandboxtest.mailgun.org",
        expect.objectContaining({
          to: "invitee@example.com",
          subject: expect.stringContaining("Wellington Netball"),
          text: expect.stringContaining("https://app.scorehub.test/invite/accept?token=inv-tok"),
          html: expect.stringContaining("Wellington Netball"),
        }),
      );
    });

    it("throws when EMAIL_FROM is not configured", async () => {
      delete process.env.EMAIL_FROM;
      const { sendInvitationEmail } = await import("../email");
      await expect(
        sendInvitationEmail({ to: "a@b.com", orgName: "Org", role: "ADMIN", token: "t" }),
      ).rejects.toThrow("EMAIL_FROM is not configured");
    });

    it("throws when MAILGUN_DOMAIN is not configured", async () => {
      delete process.env.MAILGUN_DOMAIN;
      const { sendInvitationEmail } = await import("../email");
      await expect(
        sendInvitationEmail({ to: "a@b.com", orgName: "Org", role: "ADMIN", token: "t" }),
      ).rejects.toThrow("MAILGUN_DOMAIN is not configured");
    });
  });

  describe("sendPaymentFailedEmail", () => {
    it("sends to all recipients with an /account link", async () => {
      const { sendPaymentFailedEmail } = await import("../email");
      await sendPaymentFailedEmail({ to: ["a@example.com", "b@example.com"] });
      expect(sendMock).toHaveBeenCalledWith(
        "sandboxtest.mailgun.org",
        expect.objectContaining({
          to: ["a@example.com", "b@example.com"],
          text: expect.stringContaining("https://app.scorehub.test/account"),
        }),
      );
    });

    it("no-ops when the recipient list is empty", async () => {
      const { sendPaymentFailedEmail } = await import("../email");
      await sendPaymentFailedEmail({ to: [] });
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("throws when EMAIL_FROM is not configured and recipients exist", async () => {
      delete process.env.EMAIL_FROM;
      const { sendPaymentFailedEmail } = await import("../email");
      await expect(sendPaymentFailedEmail({ to: ["a@example.com"] })).rejects.toThrow(
        "EMAIL_FROM is not configured",
      );
    });

    it("throws when MAILGUN_DOMAIN is not configured and recipients exist", async () => {
      delete process.env.MAILGUN_DOMAIN;
      const { sendPaymentFailedEmail } = await import("../email");
      await expect(sendPaymentFailedEmail({ to: ["a@example.com"] })).rejects.toThrow(
        "MAILGUN_DOMAIN is not configured",
      );
    });
  });
});
