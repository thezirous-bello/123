import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "./testUtils.js";
import { getBotState, isEmergencyStopped, resumeFromEmergencyStop, setRunning, triggerEmergencyStop } from "../src/engine/emergency.js";

beforeEach(() => {
  resetDb();
});

describe("emergency stop", () => {
  it("is not active by default", () => {
    expect(isEmergencyStopped()).toBe(false);
  });

  it("stops the bot and records who triggered it and why", () => {
    setRunning(true);
    const state = triggerEmergencyStop("test-user", "unexpected loss streak");
    expect(state.emergencyStopped).toBe(true);
    expect(state.running).toBe(false);
    expect(state.emergencyStoppedBy).toBe("test-user");
    expect(state.emergencyStoppedReason).toBe("unexpected loss streak");
    expect(state.emergencyStoppedAt).not.toBeNull();
  });

  it("requires an explicit resume call — it never clears itself", () => {
    triggerEmergencyStop("test-user", "reason");
    expect(isEmergencyStopped()).toBe(true);
    expect(isEmergencyStopped()).toBe(true); // reading state again does not clear it
    resumeFromEmergencyStop("test-user");
    expect(isEmergencyStopped()).toBe(false);
  });

  it("leaves the bot stopped after resuming — resume does not auto-restart trading", () => {
    setRunning(true);
    triggerEmergencyStop("test-user", "reason");
    const resumed = resumeFromEmergencyStop("test-user");
    expect(resumed.emergencyStopped).toBe(false);
    expect(resumed.running).toBe(false);
  });

  it("reflects the current state via getBotState", () => {
    triggerEmergencyStop("test-user", "reason");
    expect(getBotState().emergencyStopped).toBe(true);
  });
});
