import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import SuCoModel from '@/models/SuCo';
import type {
  SuCoData,
  CreateSuCoInput,
  UpdateSuCoInput,
  SuCoQueryOptions,
  PaginatedResult,
} from '../types';

function normalize(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const id = obj._id?.toString() ?? obj.id;
  const { _id, __v, ...rest } = obj;
  return { ...rest, id };
}

function normalizeSuCo(doc: any): SuCoData {
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

  // khachThue → khachThueId
  if (obj.khachThue && typeof obj.khachThue === 'object') {
    const populated = normalize(obj.khachThue);
    obj.khachThueId = populated.id;
    obj.khachThue = populated;
  } else if (obj.khachThue) {
    obj.khachThueId = obj.khachThue.toString();
    obj.khachThue = undefined;
  }

  // nguoiXuLy → nguoiXuLyId
  if (obj.nguoiXuLy && typeof obj.nguoiXuLy === 'object') {
    const populated = normalize(obj.nguoiXuLy);
    obj.nguoiXuLyId = populated.id;
    obj.nguoiXuLy = populated;
  } else if (obj.nguoiXuLy) {
    obj.nguoiXuLyId = obj.nguoiXuLy.toString();
    obj.nguoiXuLy = undefined;
  }

  return obj as SuCoData;
}

export default class SuCoRepository {
  async findById(id: string): Promise<SuCoData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await SuCoModel.findById(id)
      .populate('phong', 'maPhong tang')
      .populate('khachThue', 'hoTen soDienThoai email')
      .populate('nguoiXuLy', 'ten email');
    if (!doc) return null;
    return normalizeSuCo(doc);
  }

  async findMany(opts: SuCoQueryOptions): Promise<PaginatedResult<SuCoData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.search) {
      filter.$or = [
        { tieuDe: { $regex: opts.search, $options: 'i' } },
        { moTa: { $regex: opts.search, $options: 'i' } },
      ];
    }
    if (opts.phongId && mongoose.isValidObjectId(opts.phongId)) {
      filter.phong = new mongoose.Types.ObjectId(opts.phongId);
    }
    if (opts.loaiSuCo) filter.loaiSuCo = opts.loaiSuCo;
    if (opts.trangThai) filter.trangThai = opts.trangThai;
    if (opts.mucDoUuTien) filter.mucDoUuTien = opts.mucDoUuTien;

    const [docs, total] = await Promise.all([
      SuCoModel.find(filter)
        .populate('phong', 'maPhong tang')
        .populate('khachThue', 'hoTen soDienThoai email')
        .populate('nguoiXuLy', 'ten email')
        .skip(skip)
        .limit(limit)
        .sort({ ngayBaoCao: -1 }),
      SuCoModel.countDocuments(filter),
    ]);

    return {
      data: docs.map(normalizeSuCo),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateSuCoInput): Promise<SuCoData> {
    await dbConnect();
    const doc = await SuCoModel.create({
      phong: new mongoose.Types.ObjectId(data.phongId),
      khachThue: new mongoose.Types.ObjectId(data.khachThueId),
      tieuDe: data.tieuDe,
      moTa: data.moTa,
      anhSuCo: data.anhSuCo ?? [],
      loaiSuCo: data.loaiSuCo,
      mucDoUuTien: data.mucDoUuTien ?? 'trungBinh',
    });
    await doc.populate([
      { path: 'phong', select: 'maPhong tang' },
      { path: 'khachThue', select: 'hoTen soDienThoai email' },
    ]);
    return normalizeSuCo(doc);
  }

  async update(id: string, data: UpdateSuCoInput): Promise<SuCoData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;

    // Use save() to trigger pre-save hook for ngayXuLy / ngayHoanThanh
    const doc = await SuCoModel.findById(id);
    if (!doc) return null;

    if (data.trangThai !== undefined) {
      doc.trangThai = data.trangThai;
      // pre-save hook handles ngayXuLy / ngayHoanThanh, but allow explicit override
    }
    if (data.nguoiXuLyId !== undefined && mongoose.isValidObjectId(data.nguoiXuLyId)) {
      doc.nguoiXuLy = new mongoose.Types.ObjectId(data.nguoiXuLyId) as any;
    }
    if (data.ghiChuXuLy !== undefined) doc.ghiChuXuLy = data.ghiChuXuLy;
    if (data.ngayXuLy !== undefined) doc.ngayXuLy = new Date(data.ngayXuLy);
    if (data.ngayHoanThanh !== undefined) doc.ngayHoanThanh = new Date(data.ngayHoanThanh);
    if (data.anhSuCo !== undefined) doc.anhSuCo = data.anhSuCo;

    await doc.save();

    await doc.populate([
      { path: 'phong', select: 'maPhong tang' },
      { path: 'khachThue', select: 'hoTen soDienThoai email' },
      { path: 'nguoiXuLy', select: 'ten email' },
    ]);
    return normalizeSuCo(doc);
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await SuCoModel.findByIdAndDelete(id);
    return result !== null;
  }
}
