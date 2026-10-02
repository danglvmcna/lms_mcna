import { describe, expect, it } from "vitest";
import { rowsFor } from "../../src/components/admin/SystemStatusCard";
import { SystemStatus } from "../../src/types";

const status = (overrides: Partial<SystemStatus> = {}): SystemStatus => ({
  environment: "production",
  sepay: false,
  email: true,
  appUrl: true,
  storage: "database",
  crmOutbound: false,
  crmInbound: false,
  cron: true,
  googleWorkspace: false,
  salesMode: "direct",
  crmDatabase: "ok",
  defaultStudentPassword: true,
  ...overrides
});

const row = (rows: ReturnType<typeof rowsFor>, label: string) => rows.find(item => item.label.startsWith(label))!;

describe("system status rows", () => {
  it("does not count the self-service integrations as missing in direct sale", () => {
    const rows = rowsFor(status());
    expect(rows.filter(item => item.state === "missing")).toEqual([]);
    expect(row(rows, "Tự xác nhận chuyển khoản").state).toBe("optional");
    expect(row(rows, "Gửi dữ liệu sang CRM").state).toBe("optional");
    expect(row(rows, "Nhận dữ liệu từ CRM qua API").state).toBe("optional");
  });

  it("still asks for them in self-service mode", () => {
    const rows = rowsFor(status({ salesMode: "self_service" }));
    expect(row(rows, "Tự xác nhận chuyển khoản").state).toBe("missing");
    expect(row(rows, "Gửi dữ liệu sang CRM").state).toBe("missing");
  });

  it("reports each result of the CRM database check", () => {
    expect(row(rowsFor(status({ crmDatabase: "ok" })), "Đọc danh sách").state).toBe("ok");
    expect(row(rowsFor(status({ crmDatabase: "not_configured" })), "Đọc danh sách").state).toBe("optional");
    const certificate = row(rowsFor(status({ crmDatabase: "certificate" })), "Đọc danh sách");
    expect(certificate).toMatchObject({ state: "missing", settings: "CRM_DATABASE_CA_CERT" });
    expect(row(rowsFor(status({ crmDatabase: "unreachable" })), "Đọc danh sách")).toMatchObject({ state: "missing", settings: "CRM_DATABASE_URL" });
  });

  it("says where email buttons point when the LMS address is not set", () => {
    const missing = row(rowsFor(status({ appUrl: false })), "Đường dẫn LMS");
    expect(missing.state).toBe("missing");
    expect(missing.text).toContain("lms.mcna.vn");
    expect(missing.settings).toContain("APP_URL");
  });

  it("treats the default learner password as optional", () => {
    expect(row(rowsFor(status({ defaultStudentPassword: false })), "Mật khẩu mặc định").state).toBe("optional");
    expect(row(rowsFor(status()), "Mật khẩu mặc định").state).toBe("ok");
  });
});
