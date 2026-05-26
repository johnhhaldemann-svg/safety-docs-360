import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendTrainingAssignmentEmail } from "./trainingAssignmentEmail";

describe("trainingAssignmentEmail", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends a training assignment email with assignment context", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("TRAINING_ASSIGNMENT_FROM_EMAIL", "training@example.com");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: "email-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTrainingAssignmentEmail({
      toEmail: "worker@example.com",
      workerName: "Jordan Lee",
      companyName: "Builder Co",
      assignedByName: "Safety Manager",
      assignmentTitle: "Assign Fall Protection to Jordan Lee",
      requirementTitle: "Fall Protection",
      detail: "Jordan has an overdue training signal.",
      dueAt: "2026-06-01T00:00:00.000Z",
      jobsiteName: "North Tower",
      resourceTitle: "Fall protection course",
      resourceUrl: "https://training.example.com/fall-protection",
      resourceInstructions: "Complete the course and upload the certificate.",
      assignmentUrl: "/training-matrix?action=action-1",
    });

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer re_test_key" }),
      })
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe("training@example.com");
    expect(body.to).toEqual(["worker@example.com"]);
    expect(body.subject).toBe("Training assigned: Fall Protection");
    expect(body.html).toContain("Start Training");
    expect(body.html).toContain("https://training.example.com/fall-protection");
    expect(body.html).toContain("Open assignment in SafePredict");
    expect(body.text).toContain("North Tower");
    expect(body.text).toContain("Start training: https://training.example.com/fall-protection");
  });

  it("skips when email delivery is not configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("TRAINING_ASSIGNMENT_FROM_EMAIL", "training@example.com");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTrainingAssignmentEmail({
      toEmail: "worker@example.com",
      workerName: "Jordan Lee",
      companyName: "Builder Co",
      assignedByName: "Safety Manager",
      assignmentTitle: "Assign Fall Protection to Jordan Lee",
      requirementTitle: "Fall Protection",
      detail: "Jordan has an overdue training signal.",
    });

    expect(result.sent).toBe(false);
    expect(result.status).toBe("skipped");
    expect(result.warning).toContain("RESEND_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
