import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecoveryCode,
  createSalt,
  hashAccessCode,
  verifyAccessCode,
} from "../lib/server/crypto";
import { isSameOrigin, rawTrimmed } from "../lib/server/http";

test("hashAccessCode et verifyAccessCode valident les codes avec sel", () => {
  const salt1 = createSalt();
  const salt2 = createSalt();
  const hash1 = hashAccessCode("ROND-1024", salt1);
  const hash2 = hashAccessCode("ROND-1024", salt2);

  assert.notEqual(hash1, hash2);
  assert.equal(verifyAccessCode("ROND-1024", salt1, hash1), true);
  assert.equal(verifyAccessCode("MAUVAIS-CODE", salt1, hash1), false);
});

test("createRecoveryCode génère un code KNR-XXXX-XXXX sans caractères ambigus", () => {
  for (let i = 0; i < 25; i += 1) {
    const code = createRecoveryCode();
    assert.match(
      code,
      /^KNR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/,
    );
  }
});

test("rawTrimmed ne tronque pas les codes dépassant 72 caractères", () => {
  const longCode = `  ${"A".repeat(80)}  `;
  assert.equal(rawTrimmed(longCode).length, 80);
});

test("isSameOrigin contrôle Origin, Sec-Fetch-Site et Referer", () => {
  const makeReq = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/actions", {
      method: "POST",
      headers,
    });

  assert.equal(
    isSameOrigin(makeReq({ host: "localhost:3000", origin: "http://localhost:3000" })),
    true,
  );
  assert.equal(
    isSameOrigin(makeReq({ host: "localhost:3000", origin: "https://evil.example" })),
    false,
  );
  assert.equal(
    isSameOrigin(makeReq({ host: "localhost:3000", "sec-fetch-site": "cross-site" })),
    false,
  );
  assert.equal(
    isSameOrigin(makeReq({ host: "localhost:3000", "sec-fetch-site": "same-origin" })),
    true,
  );
  assert.equal(
    isSameOrigin(makeReq({ host: "localhost:3000", referer: "https://evil.example/form" })),
    false,
  );
  assert.equal(
    isSameOrigin(makeReq({ host: "localhost:3000", referer: "http://localhost:3000/app" })),
    true,
  );
  assert.equal(isSameOrigin(makeReq({ host: "localhost:3000" })), true);
});
