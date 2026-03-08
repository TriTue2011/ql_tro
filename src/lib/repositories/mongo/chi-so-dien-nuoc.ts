import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ChiSoDienNuocModel from '@/models/ChiSoDienNuoc';
import type {
  ChiSoDienNuocData,
  CreateChiSoInput,
  ChiSoQueryOptions,
  PaginatedResult,
} from '../types';

function normalize(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const id = obj._id?.toString() ?? obj.id;
  const { _id, __v, ...rest } = obj;
  return { ...rest, id };
}

function normalizeChiSo(doc: any): ChiSoDienNuocData {
  const obj = normalize(doc);

  // phong → phongId
  if (obj.phong && typeof obj.phong === 'object') {
    const populated = normalize(obj.phong);
    obj.phongId = populated.id;
    obj.phong = populated;
  } else if (obj.phong) {
    obj.phongId = obj.phong.toString();
    obj.phong = undefined;
  }

  // nguoiGhi → nguoiGhiId
  if (obj.nguoiGhi && typeof obj.nguoiGhi === 'object') {
    const populated = normalize(obj.nguoiGhi);
    obj.nguoiGhiId = populated.id;
    obj.nguoiGhi = populated;
  } else if (obj.nguoiGhi) {
    obj.nguoiGhiId = obj.nguoiGhi.toString();
    obj.nguoiGhi = undefined;
  }

  return obj as ChiSoDienNuocData;
}

export default class ChiSoDienNuocRepository {
  async findById(id: string): Promise<ChiSoDienNuocData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ChiSoDienNuocModel.findById(id);
    if (!doc) return null;
    return normalizeChiSo(doc);
  }

  async findMany(opts: ChiSoQueryOptions): Promise<PaginatedResult<ChiSoDienNuocData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.phongId && mongoose.isValidObjectId(opts.phongId)) {
      filter.phong = new mongoose.Types.ObjectId(opts.phongId);
    }
    if (opts.thang !== undefined) {
      filter.thang = opts.thang;
    }
    if (opts.nam !== undefined) {
      filter.nam = opts.nam;
    }

    const [docs, total] = await Promise.all([
      ChiSoDienNuocModel.find(filter).skip(skip).limit(limit).sort({ nam: -1, thang: -1 }),
      ChiSoDienNuocModel.countDocuments(filter),
    ]);

    return {
      data: docs.map(normalizeChiSo),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByPhongThangNam(
    phongId: string,
    thang: number,
    nam: number
  ): Promise<ChiSoDienNuocData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(phongId)) return null;
    const doc = await ChiSoDienNuocModel.findOne({
      phong: new mongoose.Types.ObjectId(phongId),
      thang,
      nam,
    });
    if (!doc) return null;
    return normalizeChiSo(doc);
  }

  async create(data: CreateChiSoInput): Promise<ChiSoDienNuocData> {
    await dbConnect();
    const doc = await ChiSoDienNuocModel.create({
      phong: new mongoose.Types.ObjectId(data.phongId),
      thang: data.thang,
      nam: data.nam,
      chiSoDienCu: data.chiSoDienCu,
      chiSoDienMoi: data.chiSoDienMoi,
      // soDienTieuThu calculated by pre-save hook
      soDienTieuThu: Math.max(0, data.chiSoDienMoi - data.chiSoDienCu),
      chiSoNuocCu: data.chiSoNuocCu,
      chiSoNuocMoi: data.chiSoNuocMoi,
      // soNuocTieuThu calculated by pre-save hook
      soNuocTieuThu: Math.max(0, data.chiSoNuocMoi - data.chiSoNuocCu),
      anhChiSoDien: data.anhChiSoDien,
      anhChiSoNuoc: data.anhChiSoNuoc,
      nguoiGhi: new mongoose.Types.ObjectId(data.nguoiGhiId),
      ngayGhi: data.ngayGhi ? new Date(data.ngayGhi) : new Date(),
    });
    return normalizeChiSo(doc);
  }

  async update(id: string, data: Partial<CreateChiSoInput>): Promise<ChiSoDienNuocData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;

    // Use save() to trigger pre-save hook for soDienTieuThu / soNuocTieuThu recalculation
    const doc = await ChiSoDienNuocModel.findById(id);
    if (!doc) return null;

    if (data.chiSoDienCu !== undefined) doc.chiSoDienCu = data.chiSoDienCu;
    if (data.chiSoDienMoi !== undefined) doc.chiSoDienMoi = data.chiSoDienMoi;
    if (data.chiSoNuocCu !== undefined) doc.chiSoNuocCu = data.chiSoNuocCu;
    if (data.chiSoNuocMoi !== undefined) doc.chiSoNuocMoi = data.chiSoNuocMoi;
    if (data.anhChiSoDien !== undefined) doc.anhChiSoDien = data.anhChiSoDien;
    if (data.anhChiSoNuoc !== undefined) doc.anhChiSoNuoc = data.anhChiSoNuoc;
    if (data.ngayGhi !== undefined) doc.ngayGhi = new Date(data.ngayGhi);
    if (data.nguoiGhiId !== undefined && mongoose.isValidObjectId(data.nguoiGhiId)) {
      doc.nguoiGhi = new mongoose.Types.ObjectId(data.nguoiGhiId) as any;
    }

    await doc.save();
    return normalizeChiSo(doc);
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await ChiSoDienNuocModel.findByIdAndDelete(id);
    return result !== null;
  }
}
