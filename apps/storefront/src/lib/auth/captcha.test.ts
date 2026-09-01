import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript test runner requires the extension.
import { captchaFailedMessage, parseCaptchaToken } from "./captcha.ts";

test("reads captcha token from form data", () => {
  const formData = new FormData();
  formData.set("cf-turnstile-response", " token-abc ");
  assert.equal(parseCaptchaToken(formData), "token-abc");
});

test("maps captcha auth errors", () => {
  assert.equal(captchaFailedMessage("captcha_failed"), "De beveiligingscheck is mislukt of verlopen. Vernieuw de check en probeer opnieuw.");
  assert.equal(captchaFailedMessage("Invalid login credentials"), null);
});
