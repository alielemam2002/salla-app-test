import { describe, expect, it } from "vitest";
import { loginOptions, parseSignupMessage } from "../embeddedSignup.js";

const message = (data, origin = "https://www.facebook.com") => ({
  origin,
  data: typeof data === "string" ? data : JSON.stringify(data),
});
const signup = (event, data) => ({ type: "WA_EMBEDDED_SIGNUP", event, data });

describe("parseSignupMessage", () => {
  it("reads the ids when the merchant finishes", () => {
    expect(
      parseSignupMessage(
        message(
          signup("FINISH", {
            waba_id: "1478536534308215",
            phone_number_id: "1324055010792496",
            business_id: "42",
          }),
        ),
      ),
    ).toEqual({
      kind: "finish",
      wabaId: "1478536534308215",
      phoneNumberId: "1324055010792496",
    });
  });

  it("accepts the object form and facebook.com itself", () => {
    expect(
      parseSignupMessage({
        origin: "https://facebook.com",
        data: signup("FINISH", { waba_id: "1", phone_number_id: "2" }),
      }),
    ).toMatchObject({ kind: "finish" });
  });

  it("tells an account without a number apart", () => {
    expect(
      parseSignupMessage(
        message(signup("FINISH_ONLY_WABA", { waba_id: "1478536534308215" })),
      ),
    ).toEqual({ kind: "no_phone", wabaId: "1478536534308215" });
  });

  it("reads where the merchant stopped, and Meta's errors", () => {
    expect(
      parseSignupMessage(
        message(signup("CANCEL", { current_step: "PHONE_NUMBER_SETUP" })),
      ),
    ).toEqual({ kind: "cancel", step: "PHONE_NUMBER_SETUP" });
    expect(
      parseSignupMessage(
        message(
          signup("CANCEL", { error_message: "Phone number already in use" }),
        ),
      ),
    ).toEqual({ kind: "error", message: "Phone number already in use" });
  });

  it("ignores other origins and other messages", () => {
    const finish = signup("FINISH", { waba_id: "1", phone_number_id: "2" });
    for (const origin of [
      "https://facebook.com.evil.example",
      "https://evilfacebook.com",
      "http://localhost:5173",
      "null",
    ]) {
      expect(parseSignupMessage(message(finish, origin))).toBeNull();
    }
    expect(parseSignupMessage(message("not json"))).toBeNull();
    expect(parseSignupMessage(message({ type: "OTHER" }))).toBeNull();
    expect(parseSignupMessage(null)).toBeNull();
  });
});

describe("loginOptions", () => {
  it("asks for a code with the Embedded Signup configuration", () => {
    expect(loginOptions("1122334455")).toEqual({
      config_id: "1122334455",
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {} },
    });
  });
});
