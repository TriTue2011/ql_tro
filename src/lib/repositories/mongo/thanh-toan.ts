import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ThanhToanModel from '@/models/ThanhToan';
import type {
  ThanhToanData,
  CreateThanhToanInput,
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

function normalizeThanhToan(doc: any): ThanhToanData {
  const obj = normalize(doc);

  // hoaDon → hoaDonId
  if (obj.hoaDon && typeof obj.hoaDon === 'object') {
    const populated = normalize(obj.hoaDon);
    obj.hoaDonId = populated.id;
    obj.hoaDon = populated;
  } else if (obj.hoaDon) {
    obj.hoaDonId = obj.hoaDon.toString();
    obj.hoaDon = undefined;
  }

  // nguoiNhan → nguoiNhanId
  if (obj.nguoiNhan && typeof obj.nguoiNhan === 'object') {
    const populated = normalize(obj.nguoiNhan);
    obj.nguoiNhanId = populated.id;
    obj.nguoiNhan = populated;
  } else if (obj.nguoiNhan) {
    obj.nguoiNhanId = obj.nguoiNhan.toString();
    obj.nguoiNhan = undefined;
  }

  return obj as ThanhToanData;
}

export default class ThanhToanRepository {
  async findById(id: string): Promise<ThanhToanData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ThanhToanModel.findById(id);
    if (!doc) return null;
    return normalizeThanhToan(doc);
  }

  async findMany(
    opts: QueryOptions & { hoaDonId?: string }
  ): Promise<PaginatedResult<ThanhToanData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.hoaDonId && mongoose.isValidObjectId(opts.hoaDonId)) {
      filter.hoaDon = new mongoose.Types.ObjectId(opts.hoaDonId);
    }

    const [docs, total] = await Promise.all([
      ThanhToanModel.find(filter).skip(skip).limit(limit).sort({ ngayThanhToan: -1 }),
      ThanhToanModel.countDocuments(filter),
    ]);

    return {
      data: docs.map(normalizeThanhToan),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findByHoaDon(hoaDonId: string): Promise<ThanhToanData[]> {
    await dbConnect();
    if (!mongoose.isValidObjectId(hoaDonId)) return [];
    const docs = await ThanhToanModel.find({
      hoaDon: new mongoose.Types.ObjectId(hoaDonId),
    }).sort({ ngayThanhToan: -1 });
    return docs.map(normalizeThanhToan);
  }

  async create(data: CreateThanhToanInput): Promise<ThanhToanData> {
    await dbConnect();
    const doc = await ThanhToanModel.create({
      hoaDon: new mongoose.Types.ObjectId(data.hoaDonId),
      soTien: data.soTien,
      phuongThuc: data.phuongThuc,
      thongTinChuyenKhoan: data.thongTinChuyenKhoan,
      ngayThanhToan: data.ngayThanhToan ? new Date(data.ngayThanhToan) : new Date(),
      nguoiNhan: new mongoose.Types.ObjectId(data.nguoiNhanId),
      ghiChu: data.ghiChu,
      anhBienLai: data.anhBienLai,
    });
    return normalizeThanhToan(doc);
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await ThanhToanModel.findByIdAndDelete(id);
    return result !== null;
  }
}
