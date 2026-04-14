import { describe, expect, it } from "vitest";
import { buildSafetyWorkspaceStages, getSafetyWorkspaceStatus } from "@/components/safety-intelligence/workspaceModel";

describe("buildSafetyWorkspaceStages", () => {
  it("marks stage progression from intake to review queue", () => {
    expect(
      buildSafetyWorkspaceStages({
        hasDraft: false,
        hasIntake: false,
        hasGenerated: false,
      })[0]
    ).toMatchObject({ label: "Intake", active: true, complete: false });

    expect(
      buildSafetyWorkspaceStages({
        hasDraft: true,
        hasIntake: true,
        hasGenerated: true,
      }).map((stage) => stage.complete)
    ).toEqual([true, true, true, true]);
  });
});

describe("getSafetyWorkspaceStatus", () => {
  it("prefers user-facing messages over loading state", () => {
    expect(
      getSafetyWorkspaceStatus({
        loading: true,
        message: "Document draft generated.",
        messageTone: "success",
      })
    ).toEqual({
      tone: "success",
      message: "Document draft generated.",
    });
  });

  it("returns a loading notice when no message exists", () => {
    expect(
      getSafetyWorkspaceStatus({
        loading: true,
        message: "",
        messageTone: "neutral",
      })
    ).toEqual({
      tone: "neutral",
      message: "Loading current Safety Intelligence state...",
    });
  });
});
