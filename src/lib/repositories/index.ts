/**
 * Repository Factory
 *
 * Tự động chọn implementation dựa trên DATABASE_PROVIDER:
 *   mongodb     → MongoDB + Mongoose  (offline/local)
 *   postgresql  → PostgreSQL + Prisma (online/cloud)
 *   both        → Ghi song song cả 2 (primary: PostgreSQL, secondary: MongoDB)
 *
 * Cách dùng trong API route:
 *   import { getPhongRepo } from '@/lib/repositories';
 *   const repo = await getPhongRepo();
 *   const { data, pagination } = await repo.findMany({ page: 1, limit: 10 });
 */

export * from './types';
import { createDualWriteRepo } from './dual';

const provider = () => process.env.DATABASE_PROVIDER || 'mongodb';

// ─── NguoiDung ────────────────────────────────────────────────
export async function getNguoiDungRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/nguoi-dung'),
      import('./mongo/nguoi-dung'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/nguoi-dung');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/nguoi-dung');
  return new Repo();
}

// ─── ToaNha ───────────────────────────────────────────────────
export async function getToaNhaRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/toa-nha'),
      import('./mongo/toa-nha'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/toa-nha');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/toa-nha');
  return new Repo();
}

// ─── Phong ────────────────────────────────────────────────────
export async function getPhongRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/phong'),
      import('./mongo/phong'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/phong');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/phong');
  return new Repo();
}

// ─── KhachThue ────────────────────────────────────────────────
export async function getKhachThueRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/khach-thue'),
      import('./mongo/khach-thue'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/khach-thue');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/khach-thue');
  return new Repo();
}

// ─── HopDong ──────────────────────────────────────────────────
export async function getHopDongRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/hop-dong'),
      import('./mongo/hop-dong'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/hop-dong');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/hop-dong');
  return new Repo();
}

// ─── ChiSoDienNuoc ────────────────────────────────────────────
export async function getChiSoRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/chi-so-dien-nuoc'),
      import('./mongo/chi-so-dien-nuoc'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/chi-so-dien-nuoc');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/chi-so-dien-nuoc');
  return new Repo();
}

// ─── HoaDon ───────────────────────────────────────────────────
export async function getHoaDonRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/hoa-don'),
      import('./mongo/hoa-don'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/hoa-don');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/hoa-don');
  return new Repo();
}

// ─── ThanhToan ────────────────────────────────────────────────
export async function getThanhToanRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/thanh-toan'),
      import('./mongo/thanh-toan'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/thanh-toan');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/thanh-toan');
  return new Repo();
}

// ─── SuCo ─────────────────────────────────────────────────────
export async function getSuCoRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/su-co'),
      import('./mongo/su-co'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/su-co');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/su-co');
  return new Repo();
}

// ─── ThongBao ─────────────────────────────────────────────────
export async function getThongBaoRepo() {
  if (provider() === 'both') {
    const [{ default: PgRepo }, { default: MongoRepo }] = await Promise.all([
      import('./pg/thong-bao'),
      import('./mongo/thong-bao'),
    ]);
    return createDualWriteRepo(new PgRepo(), new MongoRepo());
  }
  if (provider() === 'postgresql') {
    const { default: Repo } = await import('./pg/thong-bao');
    return new Repo();
  }
  const { default: Repo } = await import('./mongo/thong-bao');
  return new Repo();
}
