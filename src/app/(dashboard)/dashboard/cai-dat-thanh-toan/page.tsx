"use client";

/**
 * Trang cài đặt tài khoản nhận tiền dành cho role quanLy.
 * chuNha/dongChuTro dùng trang /dashboard/cai-dat (đầy đủ hơn).
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, Save } from "lucide-react";

const BANKS = [
  "Vietcombank", "VietinBank", "BIDV", "Agribank", "MBBank", "Techcombank",
  "ACB", "VPBank", "TPBank", "Sacombank", "HDBank", "VIB", "MSB", "OCB",
  "SHB", "SeABank", "LienVietPostBank", "Eximbank", "NamABank", "ABBank",
  "VietABank", "BacABank", "VietBank", "KienLongBank", "SCB", "PGBank",
  "BaoVietBank", "VietCapitalBank", "GPBank", "NCB", "CBBank", "COOPBANK",
  "SaigonBank", "DongABank", "Oceanbank", "VRB", "Indovinabank", "PublicBank",
  "CIMB", "ShinhanBank", "HSBC", "DBSBank", "StandardChartered",
];

export default function CaiDatThanhToanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [denied, setDenied] = useState(false);
  const [form, setForm] = useState({
    nganHangTen: "",
    nganHangSoTaiKhoan: "",
    nganHangChuTaiKhoan: "",
  });

  useEffect(() => {
    document.title = "Cài đặt tài khoản nhận tiền";
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/chuNha/settings")
      .then(async (r) => {
        if (r.status === 403) {
          setDenied(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.success && data.data) {
          setForm({
            nganHangTen: data.data.nganHangTen ?? "",
            nganHangSoTaiKhoan: data.data.nganHangSoTaiKhoan ?? "",
            nganHangChuTaiKhoan: data.data.nganHangChuTaiKhoan ?? "",
          });
        }
      })
      .catch(() => toast.error("Không tải được cài đặt"))
      .finally(() => setLoading(false));
  }, [status]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/chuNha/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) toast.success("Đã lưu cài đặt");
      else toast.error(data.error || "Lưu thất bại");
    } catch {
      toast.error("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return <div className="p-6 text-sm text-indigo-500/70">Đang tải...</div>;
  }

  if (denied) {
    return (
      <div className="p-6 max-w-xl">
        <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
          <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-base md:text-lg font-semibold text-indigo-900">Không có quyền</div>
            </div>
          </div>
          <div className="p-4 md:p-6 space-y-3">
            <p className="text-sm text-indigo-600/80">
              Chủ trọ chưa bật quyền cho quản lý tự cấu hình tài khoản nhận
              tiền. Liên hệ chủ trọ để được cấp quyền.
            </p>
            <Button variant="outline" onClick={() => router.push("/dashboard")} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
              Về trang chủ
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-indigo-900">Tài khoản nhận tiền</h1>
        <p className="text-sm text-indigo-500/70 mt-1">
          Thông tin tài khoản này sẽ hiển thị trên hóa đơn PDF của các hóa đơn
          do bạn tạo.
        </p>
      </div>

      <div className="rounded-xl border-0 bg-gradient-to-br from-indigo-50/80 to-blue-50/80 shadow-lg shadow-indigo-100/50">
        <div className="flex items-center gap-3 p-4 md:p-6 border-b border-indigo-100">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <CreditCard className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-base md:text-lg font-semibold text-indigo-900">Thanh toán</div>
          </div>
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">Tên chủ tài khoản</Label>
            <Input
              value={form.nganHangChuTaiKhoan}
              onChange={(e) =>
                setForm((f) => ({ ...f, nganHangChuTaiKhoan: e.target.value }))
              }
              placeholder="VD: Nguyễn Văn A"
            />
          </div>

          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">Số tài khoản ngân hàng</Label>
            <Input
              value={form.nganHangSoTaiKhoan}
              onChange={(e) =>
                setForm((f) => ({ ...f, nganHangSoTaiKhoan: e.target.value }))
              }
              placeholder="VD: 168949669"
            />
          </div>

          <div className="rounded-xl border-2 border-indigo-100 bg-white/60 backdrop-blur-sm p-3 shadow-sm space-y-1.5">
            <Label className="text-xs md:text-sm font-semibold text-indigo-900">Ngân hàng</Label>
            <Select
              value={form.nganHangTen}
              onValueChange={(v) => setForm((f) => ({ ...f, nganHangTen: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn ngân hàng" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {BANKS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={save} disabled={saving} className="w-full md:w-auto bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white border-0 shadow-md shadow-indigo-200">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Đang lưu..." : "Lưu cài đặt"}
          </Button>
        </div>
      </div>
    </div>
  );
}
