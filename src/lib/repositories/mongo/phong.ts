import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import PhongModel from '@/models/Phong';
import type {
  PhongData,
  CreatePhongInput,
  UpdatePhongInput,
  PhongQueryOptions,
  TrangThaiPhong,
  PaginatedResult,
} from '../types';

function normalize(doc: any): any {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  const id = obj._id?.toString() ?? obj.id;
  const { _id, __v, ...rest } = obj;
  return { ...rest, id };
}

function normalizePhong(doc: any): PhongData {
  const obj = normalize(doc);
  if (obj.toaNha && typeof obj.toaNha === 'object') {
    const populated = normalize(obj.toaNha);
    obj.toaNhaId = populated.id;
    obj.toaNha = populated;
  } else if (obj.toaNha) {
    obj.toaNhaId = obj.toaNha.toString();
    obj.toaNha = undefined;
  }
  return obj as PhongData;
}

export default class PhongRepository {
  async findById(id: string): Promise<PhongData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await PhongModel.findById(id).populate('toaNha', 'tenToaNha diaChi');
    if (!doc) return null;
    return normalizePhong(doc);
  }

  async findMany(opts: PhongQueryOptions): Promise<PaginatedResult<PhongData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.search) {
      filter.$or = [
        { maPhong: { $regex: opts.search, $options: 'i' } },
        { moTa: { $regex: opts.search, $options: 'i' } },
      ];
    }
    if (opts.toaNhaId && mongoose.isValidObjectId(opts.toaNhaId)) {
      filter.toaNha = new mongoose.Types.ObjectId(opts.toaNhaId);
    }
    if (opts.trangThai) {
      filter.trangThai = opts.trangThai;
    }

    const [docs, total] = await Promise.all([
      PhongModel.find(filter).populate('toaNha', 'tenToaNha diaChi').skip(skip).limit(limit),
      PhongModel.countDocuments(filter),
    ]);

    return {
      data: docs.map(normalizePhong),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreatePhongInput): Promise<PhongData> {
    await dbConnect();
    const doc = await PhongModel.create({
      maPhong: data.maPhong,
      toaNha: new mongoose.Types.ObjectId(data.toaNhaId),
      tang: data.tang,
      dienTich: data.dienTich,
      giaThue: data.giaThue,
      tienCoc: data.tienCoc,
      moTa: data.moTa,
      anhPhong: data.anhPhong ?? [],
      tienNghi: data.tienNghi ?? [],
      soNguoiToiDa: data.soNguoiToiDa,
      ngayTinhTien: data.ngayTinhTien ?? 1,
    });
    await doc.populate('toaNha', 'tenToaNha diaChi');
    return normalizePhong(doc);
  }

  async update(id: string, data: UpdatePhongInput): Promise<PhongData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;

    const updateFields: any = {};
    if (data.tang !== undefined) updateFields.tang = data.tang;
    if (data.dienTich !== undefined) updateFields.dienTich = data.dienTich;
    if (data.giaThue !== undefined) updateFields.giaThue = data.giaThue;
    if (data.tienCoc !== undefined) updateFields.tienCoc = data.tienCoc;
    if (data.moTa !== undefined) updateFields.moTa = data.moTa;
    if (data.anhPhong !== undefined) updateFields.anhPhong = data.anhPhong;
    if (data.tienNghi !== undefined) updateFields.tienNghi = data.tienNghi;
    if (data.trangThai !== undefined) updateFields.trangThai = data.trangThai;
    if (data.soNguoiToiDa !== undefined) updateFields.soNguoiToiDa = data.soNguoiToiDa;
    if (data.ngayTinhTien !== undefined) updateFields.ngayTinhTien = data.ngayTinhTien;

    const doc = await PhongModel.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).populate('toaNha', 'tenToaNha diaChi');
    if (!doc) return null;
    return normalizePhong(doc);
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await PhongModel.findByIdAndDelete(id);
    return result !== null;
  }

  async countByToaNha(toaNhaId: string): Promise<Record<TrangThaiPhong, number>> {
    await dbConnect();
    if (!mongoose.isValidObjectId(toaNhaId)) {
      return { trong: 0, daDat: 0, dangThue: 0, baoTri: 0 };
    }

    const results = await PhongModel.aggregate([
      { $match: { toaNha: new mongoose.Types.ObjectId(toaNhaId) } },
      { $group: { _id: '$trangThai', count: { $sum: 1 } } },
    ]);

    const counts: Record<TrangThaiPhong, number> = {
      trong: 0,
      daDat: 0,
      dangThue: 0,
      baoTri: 0,
    };

    for (const r of results) {
      if (r._id in counts) {
        counts[r._id as TrangThaiPhong] = r.count;
      }
    }

    return counts;
  }
}
