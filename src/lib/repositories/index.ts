/**
 * Repository Factory — chỉ dùng PostgreSQL + Prisma
 */

export * from './types';

export async function getNguoiDungRepo() {
  const { default: Repo } = await import('./pg/nguoi-dung');
  return new Repo();
}

export async function getToaNhaRepo() {
  const { default: Repo } = await import('./pg/toa-nha');
  return new Repo();
}

export async function getPhongRepo() {
  const { default: Repo } = await import('./pg/phong');
  return new Repo();
}

export async function getKhachThueRepo() {
  const { default: Repo } = await import('./pg/khach-thue');
  return new Repo();
}

export async function getHopDongRepo() {
  const { default: Repo } = await import('./pg/hop-dong');
  return new Repo();
}

export async function getChiSoRepo() {
  const { default: Repo } = await import('./pg/chi-so-dien-nuoc');
  return new Repo();
}

export async function getHoaDonRepo() {
  const { default: Repo } = await import('./pg/hoa-don');
  return new Repo();
}

export async function getThanhToanRepo() {
  const { default: Repo } = await import('./pg/thanh-toan');
  return new Repo();
}

export async function getSuCoRepo() {
  const { default: Repo } = await import('./pg/su-co');
  return new Repo();
}

export async function getThongBaoRepo() {
  const { default: Repo } = await import('./pg/thong-bao');
  return new Repo();
}
