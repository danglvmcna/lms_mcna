import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { api } from "../../api";
import { SystemStatus } from "../../types";
import { Badge, Button, Card, Callout, SectionTitle, Skeleton } from "../ui";

type State = "ok" | "missing" | "optional";

interface Row {
  label: string;
  state: State;
  /** What works, or what the missing setting costs, in the words staff use. */
  text: string;
  /** Setting names for whoever configures the server; shown only when something is missing. */
  settings: string;
}

// How the CRM database source reads, per result of the server's live check.
const CRM_DATABASE_ROW: Record<SystemStatus["crmDatabase"], Pick<Row, "state" | "text" | "settings">> = {
  ok: { state: "ok", text: "Nút Lấy từ CRM đọc được bảng doanh thu của CRM.", settings: "CRM_DATABASE_URL" },
  not_configured: { state: "optional", text: "Chưa cấu hình. Quản lý lớp dán bảng hoặc nhập tay danh sách đã thanh toán.", settings: "CRM_DATABASE_URL" },
  certificate: { state: "missing", text: "Đã có địa chỉ database CRM nhưng máy chủ chưa tin cậy chứng chỉ của nó. Thêm chứng chỉ CA của nhà cung cấp database.", settings: "CRM_DATABASE_CA_CERT" },
  unreachable: { state: "missing", text: "Đã có địa chỉ database CRM nhưng không đọc được. Kiểm tra chuỗi kết nối, mật khẩu và quyền đọc bảng revenue_records.", settings: "CRM_DATABASE_URL" }
};

export function rowsFor(status: SystemStatus): Row[] {
  const pick = (ok: boolean, whenOk: string, whenMissing: string, optional = false): Pick<Row, "state" | "text"> =>
    ok ? { state: "ok", text: whenOk } : { state: optional ? "optional" : "missing", text: whenMissing };
  // Direct sale takes payments and learners from the paid list, so the self-service integrations are not needed.
  const direct = status.salesMode === "direct";
  return [
    {
      label: "Tự xác nhận chuyển khoản (SePay)",
      ...pick(
        status.sepay,
        "Học viên chuyển khoản đúng nội dung là lớp tự mở.",
        direct ? "Không dùng trong mô hình direct sale: thanh toán được ghi nhận qua danh sách đã thanh toán." : "Quản trị phải bấm Kích hoạt cho từng đơn đã chuyển khoản.",
        direct
      ),
      settings: "SEPAY_API_KEY"
    },
    {
      label: "Gửi email",
      ...pick(status.email, "Gửi email tài khoản, email xếp lớp, link đặt lại mật khẩu và các thông báo quan trọng.", "Email tài khoản và email xếp lớp sẽ không được gửi tới học viên."),
      settings: "SMTP_HOST, SMTP_USER, SMTP_PASS"
    },
    {
      label: "Đường dẫn LMS trong email",
      ...pick(status.appUrl, "Nút trong email mở đúng địa chỉ LMS của máy chủ này.", "Nút trong email đang trỏ về lms.mcna.vn (mặc định). Đặt địa chỉ của máy chủ này để học viên mở đúng nơi."),
      settings: "LMS_LOGIN_URL hoặc APP_URL"
    },
    {
      label: "Đọc danh sách đã thanh toán từ CRM",
      ...CRM_DATABASE_ROW[status.crmDatabase]
    },
    {
      label: "Mật khẩu mặc định cho học viên mới",
      ...pick(status.defaultStudentPassword, "Được điền sẵn khi nhập danh sách đã thanh toán.", "Quản lý lớp tự gõ mật khẩu mặc định mỗi lần nhập danh sách.", true),
      settings: "DEFAULT_STUDENT_PASSWORD (tối thiểu 8 ký tự)"
    },
    {
      label: "Nơi lưu tài liệu",
      ...pick(
        status.storage === "supabase",
        "Tài liệu buổi học lưu trên Supabase Storage.",
        "Tài liệu đang lưu trong cơ sở dữ liệu. Vẫn dùng được; nên chuyển sang Supabase Storage khi tài liệu nhiều.",
        true
      ),
      settings: "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    },
    {
      label: "Gửi dữ liệu sang CRM",
      ...pick(status.crmOutbound, "Đăng ký, ghi danh và thanh toán được gửi sang CRM.", "Sự kiện đang nằm chờ, chưa được gửi sang CRM.", direct),
      settings: "CRM_WEBHOOK_URL, CRM_WEBHOOK_SECRET"
    },
    {
      label: "Nhận dữ liệu từ CRM qua API",
      ...pick(status.crmInbound, "CRM gửi được khóa học, học viên và thanh toán vào LMS.", "CRM chưa gọi được vào LMS. Không cần khi LMS đọc thẳng database CRM.", direct),
      settings: "CRM_API_KEY, CRM_INBOUND_SECRET"
    },
    {
      label: "Đồng bộ CRM theo lịch",
      ...pick(status.cron, "Hàng đợi CRM được gửi lại định kỳ.", "Hàng đợi CRM chỉ được gửi khi có thao tác mới hoặc khi bấm Đồng bộ ngay."),
      settings: "CRON_SECRET"
    },
    {
      label: "Cấp email trường (Google Workspace)",
      ...pick(status.googleWorkspace, "Học viên được cấp email trường tự động.", "Không bắt buộc. Học viên dùng email cá nhân đã đăng ký.", true),
      settings: "GOOGLE_SERVICE_ACCOUNT_JSON, SCHOOL_EMAIL_DOMAIN"
    }
  ];
}

const ICON: Record<State, React.ReactNode> = {
  ok: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  missing: <AlertTriangle className="h-5 w-5 text-amber-600" />,
  optional: <Circle className="h-5 w-5 text-slate-300" />
};
const BADGE: Record<State, { tone: "success" | "warning" | "neutral"; label: string }> = {
  ok: { tone: "success", label: "Đã cấu hình" },
  missing: { tone: "warning", label: "Chưa cấu hình" },
  optional: { tone: "neutral", label: "Không bắt buộc" }
};

/** Admin overview card: which integrations this server has settings for. */
export default function SystemStatusCard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setFailed(false);
    api.getSystemStatus()
      .then(setStatus)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const rows = status ? rowsFor(status) : [];
  const missing = rows.filter(row => row.state === "missing").length;

  return (
    <section className="space-y-3">
      <SectionTitle
        title="Cấu hình hệ thống"
        description={status ? (missing ? `${missing} mục chưa cấu hình trên máy chủ này (${status.environment}).` : `Các kết nối chính đã được cấu hình (${status.environment}).`) : "Kiểm tra các kết nối thanh toán, email, lưu trữ và CRM."}
        action={<Button size="sm" variant="ghost" icon={<RefreshCw className="h-4 w-4" />} loading={loading} onClick={load}>Kiểm tra lại</Button>}
      />
      {failed ? (
        <Callout tone="warning" title="Chưa kiểm tra được cấu hình">Thử lại sau ít phút.</Callout>
      ) : !status ? (
        <Card className="space-y-3 p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-3/5" /></Card>
      ) : (
        <Card as="ul" className="divide-y divide-slate-100 overflow-hidden">
          {rows.map(row => (
            <li key={row.label} className="flex items-start gap-3 px-4 py-3.5 md:px-5">
              <span className="mt-0.5 shrink-0">{ICON[row.state]}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-slate-900">{row.label}</span>
                <span className="block text-sm leading-relaxed text-slate-500">{row.text}</span>
                {row.state !== "ok" && <span className="mt-1 block break-all font-mono text-xs text-slate-400">{row.settings}</span>}
              </span>
              <span className="hidden shrink-0 sm:block"><Badge tone={BADGE[row.state].tone}>{BADGE[row.state].label}</Badge></span>
            </li>
          ))}
        </Card>
      )}
    </section>
  );
}
