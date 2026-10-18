import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BACKUP_CODE_LENGTH,
  CROCKFORD,
  deviceLabel,
  formatBackupCode,
  INVITE_TTL_MS,
  isInvitationCode,
  MAX_API_BODY,
  newBackupCode,
  normalizeBackupCode,
  normalizePseudo,
  PSEUDO_MAX,
  PSEUDO_MIN,
  parseInvitationState,
  parseMeAccount,
  parseSignupAnswer,
  pseudoKey,
  SignupOptionsBody,
  SignupVerifyBody,
} from "./account.ts";

// The account rules every side shares (plan 04-01, D-02, D-04, 04-RESEARCH Patterns 3 and 5): the
// pseudo and its uniqueness key, the backup code, the invitation code, the device label, and the
// bodies and answers of the account API.

describe("normalizePseudo", () => {
  it("NFC, spaces collapsed and trimmed", () => {
    expect(normalizePseudo("  Élodie  Martin ")).toEqual({ ok: true, pseudo: "Élodie Martin" });
    // A decomposed É (E + U+0301) comes back composed.
    expect(normalizePseudo("Élodie")).toEqual({ ok: true, pseudo: "Élodie" });
  });

  it("empty, short, long", () => {
    expect(normalizePseudo("")).toEqual({ ok: false, reason: "empty" });
    expect(normalizePseudo("   ")).toEqual({ ok: false, reason: "empty" });
    expect(normalizePseudo(42)).toEqual({ ok: false, reason: "empty" });
    expect(normalizePseudo("A")).toEqual({ ok: false, reason: "short" });
    expect(normalizePseudo("a".repeat(PSEUDO_MAX + 1))).toEqual({ ok: false, reason: "long" });
    expect(normalizePseudo("é".repeat(PSEUDO_MAX))).toEqual({
      ok: true,
      pseudo: "é".repeat(PSEUDO_MAX),
    });
    expect(PSEUDO_MIN).toBe(2);
    expect(PSEUDO_MAX).toBe(20);
  });

  it("refuses other scripts and symbols (T-04-12)", () => {
    for (const bad of ["Марія", "a<b", "Zoé!", "Ana@", "李雷", "Ζωή", "a/b", "😀😀"]) {
      expect(normalizePseudo(bad), bad).toEqual({ ok: false, reason: "chars" });
    }
  });

  it("accepts accents, digits, space and ' ’ . _ -", () => {
    for (const ok of ["O'Neil", "J.-P.", "Zoé_2", "Anaïs", "Ça va", "Ève’s", "Björn", "Łukasz"]) {
      expect(normalizePseudo(ok), ok).toEqual({ ok: true, pseudo: ok });
    }
  });

  it("removes control and bidi characters before the checks", () => {
    expect(normalizePseudo("Zo‮é")).toEqual({ ok: true, pseudo: "Zoé" });
    expect(normalizePseudo("A‎")).toEqual({ ok: false, reason: "short" });
    expect(normalizePseudo("Ana\tMaria")).toEqual({ ok: true, pseudo: "Ana Maria" });
    expect(normalizePseudo("Ana ⁦ Maria")).toEqual({ ok: true, pseudo: "Ana Maria" });
  });
});

describe("pseudoKey", () => {
  it("ignores case and accents", () => {
    expect(pseudoKey("Élodie")).toBe(pseudoKey("elodie"));
    expect(pseudoKey("ELODIE")).toBe(pseudoKey("elodie"));
    expect(pseudoKey("Zoé")).toBe("zoe");
    expect(pseudoKey("O’Neil")).toBe(pseudoKey("o'neil"));
  });

  it("keeps what tells two people apart", () => {
    expect(pseudoKey("Marie D")).not.toBe(pseudoKey("Marie"));
    expect(pseudoKey("Ana2")).not.toBe(pseudoKey("Ana"));
  });

  it("is idempotent on every accepted pseudo", () => {
    const letters = [..."aAeEéÉèÊëİıiIoOœŒßçÇñÑøØåÅłŁ0123456789 '’._-"];
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...letters), { minLength: 2, maxLength: 20 }),
        (chars) => {
          const result = normalizePseudo(chars.join(""));
          if (!result.ok) return;
          const key = pseudoKey(result.pseudo);
          expect(pseudoKey(key)).toBe(key);
        },
      ),
    );
  });
});

describe("backup code", () => {
  it("20 Crockford symbols from the random source", () => {
    expect(CROCKFORD).toBe("0123456789ABCDEFGHJKMNPQRSTVWXYZ");
    expect(BACKUP_CODE_LENGTH).toBe(20);
    const code = newBackupCode();
    expect(code).toMatch(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{20}$/);
    expect(newBackupCode()).not.toBe(code);
    // A fixed source gives a fixed code: byte & 31 indexes the alphabet.
    const fixed = newBackupCode((bytes) => {
      bytes.forEach((_, i) => {
        bytes[i] = i + 32 * (i % 3);
      });
    });
    expect(fixed).toBe("0123456789ABCDEFGHJK");
  });

  it("is shown as five groups of four", () => {
    expect(formatBackupCode("K7QM2XRAP9DWHT4ENB6Z")).toBe("K7QM-2XRA-P9DW-HT4E-NB6Z");
  });

  it("reads back what a person types", () => {
    const code = "K7QM2XRAP9DWHT4ENB6Z";
    expect(normalizeBackupCode("K7QM-2XRA-P9DW-HT4E-NB6Z")).toBe(code);
    expect(normalizeBackupCode(" k7qm 2xra p9dw ht4e nb6z ")).toBe(code);
    expect(normalizeBackupCode("O1IL-0000-0000-0000-0000")).toBe("01110000000000000000");
    expect(normalizeBackupCode("K7QM-2XRA-P9DW-HT4E-NB6")).toBeNull();
    expect(normalizeBackupCode("K7QM-2XRA-P9DW-HT4E-NB6ZZ")).toBeNull();
    expect(normalizeBackupCode("U7QM-2XRA-P9DW-HT4E-NB6Z")).toBeNull();
    expect(normalizeBackupCode(12)).toBeNull();
  });
});

describe("invitation code and device label", () => {
  it("an invitation code is 22 base64url characters", () => {
    expect(isInvitationCode("abcdefghijklmnopqrstu_")).toBe(true);
    expect(isInvitationCode("abcdefghijklmnopqrstu")).toBe(false);
    expect(isInvitationCode("abcdefghijklmnopqrstu_-")).toBe(false);
    expect(isInvitationCode("abcdefghijklmnopqrstu=")).toBe(false);
    expect(isInvitationCode(null)).toBe(false);
    expect(INVITE_TTL_MS).toBe(7 * 24 * 3600 * 1000);
  });

  it("names the device from its user agent", () => {
    const ua = {
      iPhone:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      iPad: "Mozilla/5.0 (iPad; CPU OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      Android:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36",
      Mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
      Windows:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      Linux:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
    };
    for (const [label, agent] of Object.entries(ua)) expect(deviceLabel(agent)).toBe(label);
    expect(deviceLabel("curl/8.0")).toBe("Appareil");
    expect(deviceLabel(null)).toBe("Appareil");
  });
});

const REGISTRATION = {
  id: "AAAAAAAAAAAAAAAAAAAAAA",
  rawId: "AAAAAAAAAAAAAAAAAAAAAA",
  type: "public-key",
  response: {
    clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
    attestationObject: "o2NmbXRkbm9uZQ",
    transports: ["internal", "hybrid"],
    publicKeyAlgorithm: -7,
  },
  clientExtensionResults: { credProps: { rk: true } },
  authenticatorAttachment: "platform",
};

describe("account API bodies", () => {
  it("the sign-up options body is strict", () => {
    const body = { invitation: "abcdefghijklmnopqrstu_", pseudo: "Zoé" };
    expect(SignupOptionsBody.safeParse(body).success).toBe(true);
    expect(SignupOptionsBody.safeParse({ ...body, extra: 1 }).success).toBe(false);
    expect(SignupOptionsBody.safeParse({ invitation: body.invitation }).success).toBe(false);
    expect(SignupOptionsBody.safeParse({ ...body, pseudo: "x".repeat(201) }).success).toBe(false);
    expect(MAX_API_BODY).toBe(8192);
  });

  it("the verify body takes a registration response, strict and length-capped", () => {
    expect(SignupVerifyBody.safeParse({ response: REGISTRATION }).success).toBe(true);
    const bad = [
      { ...REGISTRATION, type: "password" },
      { ...REGISTRATION, extra: true },
      { ...REGISTRATION, id: "A".repeat(2000) },
      { ...REGISTRATION, id: "not base64url!" },
      { ...REGISTRATION, response: { ...REGISTRATION.response, clientDataJSON: "A".repeat(9000) } },
      { ...REGISTRATION, response: { ...REGISTRATION.response, other: "x" } },
      { ...REGISTRATION, response: { ...REGISTRATION.response, transports: ["x".repeat(100)] } },
    ];
    for (const response of bad) {
      expect(SignupVerifyBody.safeParse({ response }).success).toBe(false);
    }
    expect(SignupVerifyBody.safeParse({ response: REGISTRATION, more: 1 }).success).toBe(false);
  });
});

describe("account API answers", () => {
  const me = {
    id: "u".repeat(22),
    pseudo: "Zoé",
    createdAt: 1_792_000_000_000,
    passkeys: [
      {
        id: "AAAA",
        label: "iPhone",
        createdAt: 1_792_000_000_000,
        lastUsedAt: null,
        backedUp: true,
        current: true,
      },
    ],
    hasBackupCode: true,
    backupAt: 1_792_000_000_000,
  };

  it("reads an account, and nothing else", () => {
    expect(parseMeAccount(me)).toEqual(me);
    expect(parseMeAccount({ ...me, pseudo: 3 })).toBeNull();
    expect(parseMeAccount("<html>")).toBeNull();
    expect(parseMeAccount({ ...me, passkeys: [{ id: "x" }] })).toBeNull();
  });

  it("reads the four invitation states", () => {
    const at = 1_792_000_000_000;
    for (const state of [
      { state: "ok", inviter: "Ana", expiresAt: at },
      { state: "ok", inviter: null, bootstrap: true },
      { state: "used", inviter: "Ana" },
      { state: "expired", inviter: null },
      { state: "unknown" },
    ]) {
      expect(parseInvitationState(state), JSON.stringify(state)).toEqual(state);
    }
    expect(parseInvitationState({ state: "maybe" })).toBeNull();
    expect(parseInvitationState(null)).toBeNull();
  });

  it("reads a sign-up answer: the account and a code of 20 symbols", () => {
    const answer = { me, backupCode: "K7QM2XRAP9DWHT4ENB6Z" };
    expect(parseSignupAnswer(answer)).toEqual(answer);
    expect(parseSignupAnswer({ me, backupCode: "short" })).toBeNull();
    expect(parseSignupAnswer({ backupCode: answer.backupCode })).toBeNull();
  });
});
