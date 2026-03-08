import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import HopDongModel from '@/models/HopDong';
import type {
  HopDongData,
  CreateHopDongInput,
  UpdateHopDongInput,
  HopDongQueryOptions,
  PaginatedResult,
} from '../types';

function normalize(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const id = (obj._id?.toString()) ?? obj.id;
  const { _id, __v, ...rest } = obj;
  return { ...rest, id };
}

function normalizeHopDong(doc: any): HopDongData {
  const obj = normalize(doc);

  // phong -> phongId
  if (obj.phong && typeof obj.phong === 'object' && !Array.isArray(obj.phong)) {
    const populated = normalize(obj.phong);
    obj.phongId = populated.id;
    obj.phong = populated;
  } else if (obj.phong) {
    obj.phongId = obj.phong.toString();
    obj.phong = undefined;
  }

  // khachThueId (array) -> khachThueIds
  if (Array.isArray(obj.khachThueId)) {
    obj.khachThueIds = obj.khachThueId.map((k: any) => {
      if (k && typeof k === 'object' && k._id) {
        return normalize(k).id;
      }
      return k?.toString() ?? k;
    });
    obj.khachThue = obj.khachThueId.filter((k: any) => k && typeof k === 'object' && k._id).map(normalize);
    delete obj.khachThueId;
  } else {
    obj.khachThueIds = [];
  }

  // nguoiDaiDien -> nguoiDaiDienId
  if (obj.nguoiDaiDien && typeof obj.nguoiDaiDien === 'object' && obj.nguoiDaiDien._id) {
    const populated = normalize(obj.nguoiDaiDien);
    obj.nguoiDaiDienId = populated.id;
    obj.nguoiDaiDien = populated;
  } else if (obj.nguoiDaiDien) {
    obj.nguoiDaiDienId = obj.nguoiDaiDien.toString();
    obj.nguoiDaiDien = undefined;
  }

  return obj as HopDongData;
}

export default class HopDongRepository {
  async findById(id: string): Promise<HopDongData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await HopDongModel.findById(id)
      .populate('phong', 'maPhong tang giaThue')
      .populate('khachThueId', 'hoTen soDienThoai cccd')
      .populate('nguoiDaiDien', 'hoTen soDienThoai');
    if (!doc) return null;
    return normalizeHopDong(doc);
  }

  async findMany(opts: HopDongQueryOptions): Promise<PaginatedResult<HopDongData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.search) {
      filter.$or = [
        { maHopDong: { $regex: opts.search, $options: 'i' } },
        { dieuKhoan: { $regex: opts.search, $options: 'i' } },
      ];
    }
    if (opts.phongId && mongoose.isValidObjectId(opts.phongId)) {
      filter.phong = new mongoose.Types.ObjectId(opts.phongId);
    }
    if (opts.trangThai) {
      filter.trangThai = opts.trangThai;
    }
    if (opts.khachThueId && mongoose.isValidObjectId(opts.khachThueId)) {
      filter.khachThueId = new mongoose.Types.ObjectId(opts.khachThueId);
    }

    const [docs, total] = await Promise.all([
      HopDongModel.find(filter)
        .populate('phong', 'maPhong tang giaThue')
        .populate('khachThueId', 'hoTen soDienThoai cccd')
        .populate('nguoiDaiDien', 'hoTen soDienThoai')
        .skip(skip)
        .limit(limit)
        .sort({ ngayTao: -1 }),
      HopDongModel.countDocuments(filter),
    ]);

    return {
      data: docs.map(normalizeHopDong),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateHopDongInput): Promise<HopDongData> {
    await dbConnect();
    const doc = await HopDongModel.create({
      maHopDong: data.maHopDong,
      phong: new mongoose.Types.ObjectId(data.phongId),
      khachThueId: data.khachThueIds.map((id) => new mongoose.Types.ObjectId(id)),
      nguoiDaiDien: new mongoose.Types.ObjectId(data.nguoiDaiDienId),
      ngayBatDau: new Date(data.ngayBatDau),
      ngayKetThuc: new Date(data.ngayKetThuc),
      giaThue: data.giaThue,
      tienCoc: data.tienCoc,
      chuKyThanhToan: data.chuKyThanhToan ?? 'thang',
      ngayThanhToan: data.ngayThanhToan,
      dieuKhoan: data.dieuKhoan,
      giaDien: data.giaDien,
      giaNuoc: data.giaNuoc,
      chiSoDienBanDau: data.chiSoDienBanDau ?? 0,
      chiSoNuocBanDau: data.chiSoNuocBanDau ?? 0,
      phiDichVu: data.phiDichVu ?? [],
      fileHopDong: data.fileHopDong,
    });
    await doc.populate('phong', 'maPhong tang giaThue');
    await doc.populate('khachThueId', 'hoTen soDienThoai cccd');
    await doc.populate('nguoiDaiDien', 'hoTen soDienThoai');
    return normalizeHopDong(doc);
  }

  async update(id: string, data: UpdateHopDongInput): Promise<HopDongData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;

    const updateFields: any = {};
    if (data.ngayKetThuc !== undefined) updateFields.ngayKetThuc = new Date(data.ngayKetThuc);
    if (data.giaThue !== undefined) updateFields.giaThue = data.giaThue;
    if (data.tienCoc !== undefined) updateFields.tienCoc = data.tienCoc;
    if (data.chuKyThanhToan !== undefined) updateFields.chuKyThanhToan = data.chuKyThanhToan;
    if (data.ngayThanhToan !== undefined) updateFields.ngayThanhToan = data.ngayThanhToan;
    if (data.dieuKhoan !== undefined) updateFields.dieuKhoan = data.dieuKhoan;
    if (data.giaDien !== undefined) updateFields.giaDien = data.giaDien;
    if (data.giaNuoc !== undefined) updateFields.giaNuoc = data.giaNuoc;
    if (data.phiDichVu !== undefined) updateFields.phiDichVu = data.phiDichVu;
    if (data.trangThai !== undefined) updateFields.trangThai = data.trangThai;
    if (data.fileHopDong !== undefined) updateFields.fileHopDong = data.fileHopDong;

    const doc = await HopDongModel.findByIdAndUpdate(id, { $set: updateFields }, { new: true })
      .populate('phong', 'maPhong tang giaThue')
      .populate('khachThueId', 'hoTen soDienThoai cccd')
      .populate('nguoiDaiDien', 'hoTen soDienThoai');
    if (!doc) return null;
    return normalizeHopDong(doc);
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await HopDongModel.findByIdAndDelete(id);
    return result !== null;
  }

  async findActiveByPhong(phongId: string): Promise<HopDongData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(phongId)) return null;
    const doc = await HopDongModel.findOne({
      phong: new mongoose.Types.ObjectId(phongId),
      trangThai: 'hoatDong',
    })
      .populate('phong', 'maPhong tang giaThue')
      .populate('khachThueId', 'hoTen soDienThoai cccd')
      .populate('nguoiDaiDien', 'hoTen soDienThoai');
    if (!doc) return null;
    return normalizeHopDong(doc);
  }
}
