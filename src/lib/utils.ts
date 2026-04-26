import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhongName(maPhong: string, tang?: number | null): string {
  if (!tang || tang <= 0) return maPhong;
  
  // Kiểm tra xem maPhong có phải là số không, nếu là số 1 chữ số thì thêm '0'
  const isNumeric = /^\d+$/.test(maPhong);
  let formattedMaPhong = maPhong;
  if (isNumeric && maPhong.length === 1) {
    formattedMaPhong = `0${maPhong}`;
  }
  
  return `${tang}${formattedMaPhong}`;
}
