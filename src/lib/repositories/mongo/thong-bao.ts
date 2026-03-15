import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ThongBaoModel from '@/models/ThongBao';
import type {
  ThongBaoData,
  CreateThongBaoInput,
  ThongBaoQueryOptions,
  QueryOptions,
  PaginatedResult,
} from '../types';

function normalize(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const id = obj._id?.toString() ?? obj.id;
  const { _id, __v, ...rest } = obj;
  return { ...rest, id };
}

function normalizeThongBao(doc: any): ThongBaoData {
  const obj = normalize(doc);

  // nguoiGui → nguoiGuiId
  if (obj.nguoiGui && typeof obj.nguoiGui === 'object') {
    const populated = normalize(obj.nguoiGui);
    obj.nguoiGuiId = populated.id;
    obj.nguoiGui = populated;
  } else if (obj.nguoiGui) {
    obj.nguoiGuiId = obj.nguoiGui.toString();
    obj.nguoiGui = undefined;
  }

  // nguoiNhan: array of ObjectIds → array of strings
  if (Array.isArray(obj.nguoiNhan)) {
    obj.nguoiNhan = obj.nguoiNhan.map((n: any) =>
      typeof n === 'object' ? (n._id?.toString() ?? n.toString()) : n.toString()
    );
  } else {
    obj.nguoiNhan = [];
  }

  // phong: array of ObjectId refs → phongIds
  if (Array.isArray(obj.phong)) {
    obj.phongIds = obj.phong.map((p: any) =>
      typeof p === 'object' ? (p._id?.toString() ?? p.toString()) : p.toString()
    );
    delete obj.phong;
  } else {
    obj.phongIds = [];
    delete obj.phong;
  }

  // toaNha → toaNhaId
  if (obj.toaNha) {
    obj.toaNhaId = obj.toaNha.toString();
    delete obj.toaNha;
  }

  // daDoc: array of ObjectIds → array of strings
  if (Array.isArray(obj.daDoc)) {
    obj.daDoc = obj.daDoc.map((d: any) =>
      typeof d === 'object' ? (d._id?.toString() ?? d.toString()) : d.toString()
    );
  } else {
    obj.daDoc = [];
  }

  return obj as ThongBaoData;
}

export default class ThongBaoRepository {
  async findById(id: string): Promise<ThongBaoData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ThongBaoModel.findById(id);
    if (!doc) return null;
    return normalizeThongBao(doc);
  }

  async findMany(opts: ThongBaoQueryOptions): Promise<PaginatedResult<ThongBaoData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.search) {
      filter.$or = [
        { tieuDe: { $regex: opts.search, $options: 'i' } },
        { noiDung: { $regex: opts.search, $options: 'i' } },
      ];
    }
    if (opts.nguoiNhanId && mongoose.isValidObjectId(opts.nguoiNhanId)) {
      filter.nguoiNhan = new mongoose.Types.ObjectId(opts.nguoiNhanId);
    }
    if (opts.loai) filter.loai = opts.loai;

    const [docs, total] = await Promise.all([
      ThongBaoModel.find(filter).skip(skip).limit(limit).sort({ ngayGui: -1 }),
      ThongBaoModel.countDocuments(filter),
    ]);

    return {
      data: docs.map(normalizeThongBao),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByNguoiNhan(
    userId: string,
    opts: QueryOptions
  ): Promise<PaginatedResult<ThongBaoData>> {
    await dbConnect();
    if (!mongoose.isValidObjectId(userId)) {
      return {
        data: [],
        pagination: { page: 1, limit: opts.limit ?? 20, total: 0, totalPages: 0 },
      };
    }

    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {
      nguoiNhan: new mongoose.Types.ObjectId(userId),
    };
    if (opts.search) {
      filter.$or = [
        { tieuDe: { $regex: opts.search, $options: 'i' } },
        { noiDung: { $regex: opts.search, $options: 'i' } },
      ];
    }

    const [docs, total] = await Promise.all([
      ThongBaoModel.find(filter).skip(skip).limit(limit).sort({ ngayGui: -1 }),
      ThongBaoModel.countDocuments(filter),
    ]);

    return {
      data: docs.map(normalizeThongBao),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateThongBaoInput): Promise<ThongBaoData> {
    await dbConnect();
    const doc = await ThongBaoModel.create({
      tieuDe: data.tieuDe,
      noiDung: data.noiDung,
      loai: data.loai ?? 'chung',
      nguoiGui: new mongoose.Types.ObjectId(data.nguoiGuiId),
      nguoiNhan: data.nguoiNhan.map((id) => new mongoose.Types.ObjectId(id)),
      phong: data.phongIds
        ? data.phongIds.map((id) => new mongoose.Types.ObjectId(id))
        : [],
      toaNha: data.toaNhaId ? new mongoose.Types.ObjectId(data.toaNhaId) : undefined,
      daDoc: [],
      trangThaiXuLy: data.trangThaiXuLy ?? 'chuaXuLy',
    });
    return normalizeThongBao(doc);
  }

  async updateTrangThai(id: string, trangThaiXuLy: string): Promise<ThongBaoData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ThongBaoModel.findByIdAndUpdate(
      id,
      { trangThaiXuLy },
      { new: true }
    );
    if (!doc) return null;
    return normalizeThongBao(doc);
  }

  async markAsRead(id: string, userId: string): Promise<ThongBaoData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(userId)) return null;

    const doc = await ThongBaoModel.findByIdAndUpdate(
      id,
      { $addToSet: { daDoc: new mongoose.Types.ObjectId(userId) } },
      { new: true }
    );
    if (!doc) return null;
    return normalizeThongBao(doc);
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await ThongBaoModel.findByIdAndDelete(id);
    return result !== null;
  }
}
