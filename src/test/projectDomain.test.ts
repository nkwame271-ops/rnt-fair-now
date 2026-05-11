import { describe, it, expect } from "vitest";
import { ROOT_DOMAIN, SENDER_DOMAIN, PUBLIC_URL, SUPPORT_EMAIL, verifyUrl } from "@/lib/projectDomain";

describe("projectDomain (locked)", () => {
  it("is locked to rentcontrolghana.com", () => {
    expect(ROOT_DOMAIN).toBe("rentcontrolghana.com");
    expect(SENDER_DOMAIN).toBe("notify.rentcontrolghana.com");
    expect(PUBLIC_URL).toBe("https://www.rentcontrolghana.com");
    expect(SUPPORT_EMAIL).toBe("info@rentcontrolghana.com");
  });
  it("verifyUrl builds links off the locked public URL", () => {
    expect(verifyUrl("/verify/x")).toBe("https://www.rentcontrolghana.com/verify/x");
    expect(verifyUrl("verify/x")).toBe("https://www.rentcontrolghana.com/verify/x");
  });
});
