/**
 * Tính giá lũy tiến cho điện/nước.
 *
 * Bậc giá lũy tiến: mỗi bậc có [tu, den, gia]
 *   - `tu`: mốc đầu (bao gồm, vd 0)
 *   - `den`: mốc cuối (không bao gồm; dùng null/undefined = "ngoài định mức")
 *   - `gia`: đơn giá trong dải này (VND/kWh hoặc VND/m³)
 *
 * Ví dụ bảng giá điện 4 bậc:
 *   [
 *     { tu: 0,   den: 50,   gia: 2000 },   // 0-50 kWh: 2000đ
 *     { tu: 50,  den: 100,  gia: 2500 },   // 50-100 kWh: 2500đ
 *     { tu: 100, den: 200,  gia: 3000 },   // 100-200 kWh: 3000đ
 *     { tu: 200, den: null, gia: 3500 },   // >200 kWh: 3500đ
 *   ]
 */

export interface TierConfig {
  tu: number;
  den: number | null;
  gia: number;
}

export interface TierBreakdown {
  bac: number;           // Số thứ tự bậc (1, 2, 3, ...)
  tu: number;
  den: number | null;
  soLuong: number;       // Số lượng tiêu thụ trong bậc này
  donGia: number;
  thanhTien: number;
}

export interface TierCalcResult {
  total: number;
  breakdown: TierBreakdown[];
}

/**
 * Tính tiền theo bậc lũy tiến.
 * @param soLuong Tổng lượng tiêu thụ (kWh / m³)
 * @param tiers Bảng giá bậc, đã sắp xếp theo `tu` tăng dần
 */
export function calcTieredPrice(soLuong: number, tiers: TierConfig[]): TierCalcResult {
  if (soLuong <= 0 || !tiers || tiers.length === 0) {
    return { total: 0, breakdown: [] };
  }

  // Sắp xếp theo `tu` tăng dần (phòng khi input chưa sort)
  const sorted = [...tiers].sort((a, b) => a.tu - b.tu);

  let remaining = soLuong;
  const breakdown: TierBreakdown[] = [];
  let total = 0;

  for (let i = 0; i < sorted.length && remaining > 0; i++) {
    const tier = sorted[i];
    const tierCapacity = tier.den === null || tier.den === undefined
      ? Infinity
      : Math.max(0, tier.den - tier.tu);

    const used = Math.min(remaining, tierCapacity);
    if (used <= 0) continue;

    const thanhTien = used * tier.gia;
    breakdown.push({
      bac: i + 1,
      tu: tier.tu,
      den: tier.den ?? null,
      soLuong: used,
      donGia: tier.gia,
      thanhTien,
    });
    total += thanhTien;
    remaining -= used;
  }

  return { total: Math.round(total), breakdown };
}

/**
 * Parse bảng giá từ JSON (DB field) — xác thực kiểu dữ liệu.
 * Trả null nếu không hợp lệ hoặc rỗng.
 */
export function parseTierConfig(raw: unknown): TierConfig[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const result: TierConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as any;
    if (typeof o.tu !== 'number' || typeof o.gia !== 'number') continue;
    result.push({
      tu: o.tu,
      den: (o.den === null || o.den === undefined) ? null : Number(o.den),
      gia: o.gia,
    });
  }
  return result.length > 0 ? result : null;
}
