import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMarketplaceCreditPurchaseReceiptEmail } from "./marketplaceCreditReceiptEmail";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("marketplaceCreditReceiptEmail", () => {
  it("sends a configured receipt email with the purchase details", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("BILLING_FROM_EMAIL", "billing@example.com");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const result = await sendMarketplaceCreditPurchaseReceiptEmail({
      toEmail: "owner@example.com",
      companyName: "Acme & Co.",
      invoiceNumber: "INV-1001",
      invoiceId: "inv_123",
      baseUrl: "https://app.example.com/",
      packLabel: "10-credit pack",
      credits: 10,
      amountCents: 4999,
      currency: "usd",
    });

    expect(result.sent).toBe(true);
    expect(result.receiptUrl).toBe("https://app.example.com/customer/billing/invoices/inv_123");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");

    const body = JSON.parse(String(init?.body ?? "{}")) as {
      from?: string;
      to?: string[];
      subject?: string;
      html?: string;
      text?: string;
    };

    expect(body.from).toBe("billing@example.com");
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.subject).toContain("Acme & Co.");
    expect(body.html).toContain("Acme &amp; Co.");
    expect(body.html).toContain("INV-1001");
    expect(body.html).toContain("10-credit pack");
    expect(body.text).toContain("Acme & Co.");
    expect(body.text).toContain("https://app.example.com/customer/billing/invoices/inv_123");
  });

  it("strips line breaks from the subject line", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("BILLING_FROM_EMAIL", "billing@example.com");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_456" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await sendMarketplaceCreditPurchaseReceiptEmail({
      toEmail: "owner@example.com",
      companyName: "Acme\r\nCo",
      invoiceNumber: "INV-1004",
      invoiceId: "inv_999",
      baseUrl: "https://app.example.com",
      packLabel: "5-credit pack",
      credits: 5,
      amountCents: 2500,
      currency: "usd",
    });

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body ?? "{}")) as { subject?: string };
    expect(body.subject).toBe("Receipt for Acme Co marketplace credit purchase");
    expect(body.subject).not.toContain("\n");
    expect(body.subject).not.toContain("\r");
  });

  it("skips sending when receipt email delivery is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("BILLING_FROM_EMAIL", "billing@example.com");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 })
    );

    const result = await sendMarketplaceCreditPurchaseReceiptEmail({
      toEmail: "owner@example.com",
      companyName: "Acme Builders",
      invoiceNumber: "INV-1002",
      invoiceId: "inv_456",
      baseUrl: "https://app.example.com",
      packLabel: "20-credit pack",
      credits: 20,
      amountCents: 9999,
      currency: "usd",
    });

    expect(result.sent).toBe(false);
    expect(result.warning).toContain("RESEND_API_KEY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips sending when the public site url is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("BILLING_FROM_EMAIL", "billing@example.com");

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 })
    );

    const result = await sendMarketplaceCreditPurchaseReceiptEmail({
      toEmail: "owner@example.com",
      companyName: "Acme Builders",
      invoiceNumber: "INV-1003",
      invoiceId: "inv_789",
      baseUrl: "   ",
      packLabel: "30-credit pack",
      credits: 30,
      amountCents: 14999,
      currency: "usd",
    });

    expect(result.sent).toBe(false);
    expect(result.warning).toContain("NEXT_PUBLIC_SITE_URL");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
