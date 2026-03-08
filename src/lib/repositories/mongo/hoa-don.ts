import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import HoaDonModel from '@/models/HoaDon';
import type {
  HoaDonData,
  CreateHoaDonInput,
  HoaDonQueryOptions,
  PaginatedResult,
} from '../types';

function normalize(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const id = obj._id?.toString() ?? obj.id;
  const { _id, __v, ...rest } = obj;
  return { ...rest, id };
}

function normalizeHoaDon(doc: any): HoaDonData {
  const obj = normalize(doc);

  // hopDong → hopDongId
  if (obj.hopDong && typeof obj.hopDong === 'object') {
    const populated = normalize(obj.hopDong);
    obj.hopDongId = populated.id;
    obj.hopDong = populated;
  } else if (obj.hopDong) {
    obj.hopDongId = obj.hopDong.toString();
    obj.hopDong = undefined;
  }

  // phong → phongId
  if (obj.phong && typeof obj.phong === 'object') {
    const populated = normalize(obj.phong);
    obj.phongId = populated.id;
    obj.phong = populated;
  } else if (obj.phong) {
    obj.phongId = obj.phong.toString();
    obj.phong = undefined;
  }

  // khachThue → khachThueId (single ref in HoaDon)
  if (obj.khachThue && typeof obj.khachThue === 'object') {
    const populated = normalize(obj.khachThue);
    obj.khachThueId = populated.id;
    obj.khachThue = populated;
  } else if (obj.khachThue) {
    obj.khachThueId = obj.khachThue.toString();
    obj.khachThue = undefined;
  }

  return obj as HoaDonData;
}

export default class HoaDonRepository {
  async findById(id: string): Promise<HoaDonData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await HoaDonModel.findById(id)
      .populate('hopDong', 'maHopDong giaThue giaDien giaNuoc')
      .populate('phong', 'maPhong tang')
      .populate('khachThue', 'hoTen soDienThoai email');
    if (!doc) return null;
    return normalizeHoaDon(doc);
  }

  async findMany(opts: HoaDonQueryOptions): Promise<PaginatedResult<HoaDonData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.search) {
      filter.maHoaDon = { $regex: opts.search, $options: 'i' };
    }
    if (opts.hopDongId && mongoose.isValidObjectId(opts.hopDongId)) {
      filter.hopDong = new mongoose.Types.ObjectId(opts.hopDongId);
    }
    if (opts.phongId && mongoose.isValidObjectId(opts.phongId)) {
      filter.phong = new mongoose.Types.ObjectId(opts.phongId);
    }
    if (opts.khachThueId && mongoose.isValidObjectId(opts.khachThueId)) {
      filter.khachThue = new mongoose.Types.ObjectId(opts.khachThueId);
    }
    if (opts.thang !== undefined) filter.thang = opts.thang;
    if (opts.nam !== undefined) filter.nam = opts.nam;
    if (opts.trangThai) filter.trangThai = opts.trangThai;

    const [docs, total] = await Promise.all([
      HoaDonModel.find(filter)
        .populate('hopDong', 'maHopDong giaThue giaDien giaNuoc')
        .populate('phong', 'maPhong tang')
        .populate('khachThue', 'hoTen soDienThoai email')
        .skip(skip)
        .limit(limit)
        .sort({ nam: -1, thang: -1 }),
      HoaDonModel.countDocuments(filter),
    ]);

    return {
      data: docs.map(normalizeHoaDon),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateHoaDonInput): Promise<HoaDonData> {
    await dbConnect();
    const doc = await HoaDonModel.create({
      maHoaDon: data.maHoaDon,
      hopDong: new mongoose.Types.ObjectId(data.hopDongId),
      phong: new mongoose.Types.ObjectId(data.phongId),
      khachThue: new mongoose.Types.ObjectId(data.khachThueId),
      thang: data.thang,
      nam: data.nam,
      tienPhong: data.tienPhong,
      tienDien: data.tienDien,
      // soDien calculated by pre-save hook
      soDien: Math.max(0, data.chiSoDienCuoiKy - data.chiSoDienBanDau),
      chiSoDienBanDau: data.chiSoDienBanDau,
      chiSoDienCuoiKy: data.chiSoDienCuoiKy,
      tienNuoc: data.tienNuoc,
      // soNuoc calculated by pre-save hook
      soNuoc: Math.max(0, data.chiSoNuocCuoiKy - data.chiSoNuocBanDau),
      chiSoNuocBanDau: data.chiSoNuocBanDau,
      chiSoNuocCuoiKy: data.chiSoNuocCuoiKy,
      phiDichVu: data.phiDichVu ?? [],
      tongTien: data.tongTien,
      daThanhToan: 0,
      // conLai and trangThai calculated by pre-save hook
      conLai: data.tongTien,
      hanThanhToan: new Date(data.hanThanhToan),
      ghiChu: data.ghiChu,
    });
    await doc.populate([
      { path: 'hopDong', select: 'maHopDong giaThue giaDien giaNuoc' },
      { path: 'phong', select: 'maPhong tang' },
      { path: 'khachThue', select: 'hoTen soDienThoai email' },
    ]);
    return normalizeHoaDon(doc);
  }

  async update(id: string, data: Partial<HoaDonData>): Promise<HoaDonData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;

    const updateFields: any = {};
    const allowedFields = [
      'thang', 'nam', 'tienPhong', 'tienDien', 'chiSoDienBanDau', 'chiSoDienCuoiKy',
      'tienNuoc', 'chiSoNuocBanDau', 'chiSoNuocCuoiKy', 'phiDichVu', 'tongTien',
      'daThanhToan', 'hanThanhToan', 'ghiChu', 'trangThai',
    ];
    for (const field of allowedFields) {
      if ((data as any)[field] !== undefined) {
        updateFields[field] = (data as any)[field];
      }
    }

    // Use save() to trigger pre-save hook for conLai/trangThai/soDien/soNuoc recalculation
    const doc = await HoaDonModel.findById(id);
    if (!doc) return null;

    Object.assign(doc, updateFields);
    await doc.save();

    await doc.populate([
      { path: 'hopDong', select: 'maHopDong giaThue giaDien giaNuoc' },
      { path: 'phong', select: 'maPhong tang' },
      { path: 'khachThue', select: 'hoTen soDienThoai email' },
    ]);
    return normalizeHoaDon(doc);
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await HoaDonModel.findByIdAndDelete(id);
    return result !== null;
  }

  async addPayment(id: string, soTien: number): Promise<HoaDonData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;

    const doc = await HoaDonModel.findById(id);
    if (!doc) return null;

    doc.daThanhToan = (doc.daThanhToan ?? 0) + soTien;
    // conLai and trangThai will be recalculated by pre-save hook
    await doc.save();

    await doc.populate([
      { path: 'hopDong', select: 'maHopDong giaThue giaDien giaNuoc' },
      { path: 'phong', select: 'maPhong tang' },
      { path: 'khachThue', select: 'hoTen soDienThoai email' },
    ]);
    return normalizeHoaDon(doc);
  }
}
