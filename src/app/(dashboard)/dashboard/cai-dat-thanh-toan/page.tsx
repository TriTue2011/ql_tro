"use client";

/**
 * Trang cài đặt tài khoản nhận tiền dành cho role quanLy.
 * chuNha/dongChuTro dùng trang /dashboard/cai-dat (đầy đủ hơn).
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    return <div className="p-6 text-sm text-gray-500">Đang tải...</div>;
  }

  if (denied) {
    return (
      <div className="p-6 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Không có quyền</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-3">
            <p>
              Chủ trọ chưa bật quyền cho quản lý tự cấu hình tài khoản nhận
              tiền. Liên hệ chủ trọ để được cấp quyền.
            </p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Về trang chủ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Tài khoản nhận tiền</h1>
        <p className="text-sm text-gray-500 mt-1">
          Thông tin tài khoản này sẽ hiển thị trên hóa đơn PDF của các hóa đơn
          do bạn tạo.
        </p>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <CreditCard className="h-4 w-4" /> Thanh toán
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-4">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Tên chủ tài khoản</Label>
            <Input
              value={form.nganHangChuTaiKhoan}
              onChange={(e) =>
                setForm((f) => ({ ...f, nganHangChuTaiKhoan: e.target.value }))
              }
              placeholder="VD: Nguyễn Văn A"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Số tài khoản ngân hàng</Label>
            <Input
              value={form.nganHangSoTaiKhoan}
              onChange={(e) =>
                setForm((f) => ({ ...f, nganHangSoTaiKhoan: e.target.value }))
              }
              placeholder="VD: 168949669"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-medium">Ngân hàng</Label>
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

          <Button onClick={save} disabled={saving} className="w-full md:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Đang lưu..." : "Lưu cài đặt"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
