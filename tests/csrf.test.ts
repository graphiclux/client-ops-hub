import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { enforceCsrf } from "@/lib/http";

function makeRequest(options: {
  contentType?: string;
  csrfCookie?: string;
  csrfHeader?: string;
  origin?: string;
  host?: string;
}) {
  const headers = new Headers();

  headers.set("origin", options.origin ?? "http://localhost:3000");
  headers.set("host", options.host ?? "localhost:3000");

  if (options.contentType) {
    headers.set("content-type", options.contentType);
  }

  if (options.csrfHeader) {
    headers.set("x-csrf-token", options.csrfHeader);
  }

  if (options.csrfCookie) {
    headers.set("cookie", `csrf_token=${options.csrfCookie}`);
  }

  const request = new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers
  });

  return new NextRequest(request);
}

test("enforceCsrf passes for same-origin JSON with matching header+cookie", () => {
  const req = makeRequest({
    contentType: "application/json",
    csrfCookie: "abc123",
    csrfHeader: "abc123"
  });

  assert.equal(enforceCsrf(req), true);
});

test("enforceCsrf fails for JSON if CSRF header missing", () => {
  const req = makeRequest({
    contentType: "application/json",
    csrfCookie: "abc123"
  });

  assert.equal(enforceCsrf(req), false);
});

test("enforceCsrf fails for JSON if CSRF header mismatched", () => {
  const req = makeRequest({
    contentType: "application/json",
    csrfCookie: "abc123",
    csrfHeader: "wrong"
  });

  assert.equal(enforceCsrf(req), false);
});

test("enforceCsrf passes for same-origin form request with CSRF cookie", () => {
  const req = makeRequest({
    contentType: "application/x-www-form-urlencoded",
    csrfCookie: "abc123"
  });

  assert.equal(enforceCsrf(req), true);
});

test("enforceCsrf fails for cross-origin requests", () => {
  const req = makeRequest({
    contentType: "application/json",
    csrfCookie: "abc123",
    csrfHeader: "abc123",
    origin: "http://evil.example",
    host: "localhost:3000"
  });

  assert.equal(enforceCsrf(req), false);
});
