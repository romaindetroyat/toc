import { SoloReport } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import type { SoloResult } from "../game/GameController.ts";
import type { ApiDeps } from "../net/api.ts";
import { SOLO_URL, sendSoloReport, soloReportOf } from "./solo.ts";

// The solo report of plan 05-07 (D-01; 05-RESEARCH Pattern 2): the controller's result in the shape
// the Worker checks (SoloReport of @toc/protocol, 05-05), then POST /api/me/results/solo and what its
// answer means for the queue.

const RESULT: SoloResult = {
  id: "1b4e28ba-2fa1-41d2-883f-0016d3cca427",
  startedAt: 1_790_000_000_000,
  endedAt: 1_790_000_095_000,
  human: "bleu",
  winner: "bleu-rouge",
  deals: 14,
  levels: { jaune: 5, rouge: 1, vert: 3 },
  seats: {
    bleu: { captured: 3, lost: 2, home: 4 },
    jaune: { captured: 1, lost: 4, home: 2 },
    rouge: { captured: 4, lost: 1, home: 4 },
    vert: { captured: 2, lost: 3, home: 1 },
  },
};

type Call = { input: string; init: RequestInit | undefined };

function fakeApi(answer: number | "throw", online = true): { deps: ApiDeps; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    deps: {
      online: () => online,
      fetch: async (input, init) => {
        calls.push({ input, init });
        if (answer === "throw") throw new TypeError("Failed to fetch");
        return new Response(JSON.stringify({ added: answer === 201 }), {
          status: answer,
          headers: { "content-type": "application/json" },
        });
      },
    },
  };
}

describe("soloReportOf", () => {
  it("gives the report the Worker checks, with no name in it", () => {
    const report = soloReportOf(RESULT);
    expect(report).not.toBeNull();
    expect(SoloReport.safeParse(report).success).toBe(true);
    expect(report).toEqual(RESULT);
    expect(JSON.stringify(report)).not.toMatch(/name|pseudo/i);
  });

  it("gives nothing for a result out of shape (it is never sent)", () => {
    expect(soloReportOf({ ...RESULT, id: "not-a-uuid" })).toBeNull();
    // The player's own colour has no level.
    expect(
      soloReportOf({ ...RESULT, levels: { bleu: 3, jaune: 5, rouge: 1, vert: 3 } }),
    ).toBeNull();
    expect(
      soloReportOf({
        ...RESULT,
        seats: { ...RESULT.seats, vert: { captured: 0, lost: 0, home: 5 } },
      }),
    ).toBeNull();
  });

  it("copies the result: changing the report never changes the game's", () => {
    const report = soloReportOf(RESULT);
    if (report === null) throw new Error("no report");
    report.seats.bleu.captured = 99;
    expect(RESULT.seats.bleu.captured).toBe(3);
  });
});

describe("sendSoloReport", () => {
  const report = soloReportOf(RESULT) as SoloReport;

  it("posts the report as JSON to /api/me/results/solo, with the session cookie", async () => {
    const { deps, calls } = fakeApi(201);
    await sendSoloReport(report, deps);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call?.input).toBe(SOLO_URL);
    expect(SOLO_URL).toBe("/api/me/results/solo");
    expect(call?.init?.method).toBe("POST");
    expect(call?.init?.credentials).toBe("same-origin");
    expect(new Headers(call?.init?.headers).get("content-type")).toBe("application/json");
    expect(JSON.parse(String(call?.init?.body))).toEqual(report);
  });

  it.each([
    [201, "added"],
    [200, "already"],
    [400, "refused"],
    [413, "refused"],
    [415, "refused"],
    [401, "signed-out"],
    [403, "later"],
    [429, "later"],
    [500, "later"],
    [503, "later"],
  ] as const)("answers %i as %s", async (status, meaning) => {
    expect(await sendSoloReport(report, fakeApi(status).deps)).toBe(meaning);
  });

  it("is offline when the device knows it has no network, without trying", async () => {
    const { deps, calls } = fakeApi(201, false);
    expect(await sendSoloReport(report, deps)).toBe("offline");
    expect(calls).toHaveLength(0);
  });

  it("is offline when the request gets no answer at all", async () => {
    expect(await sendSoloReport(report, fakeApi("throw").deps)).toBe("offline");
  });
});
