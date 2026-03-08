import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import KhachThueModel from '@/models/KhachThue';
import type {
  KhachThueData,
  CreateKhachThueInput,
  UpdateKhachThueInput,
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

export default class KhachThueRepository {
  async findById(id: string): Promise<KhachThueData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await KhachThueModel.findById(id).select('-matKhau');
    if (!doc) return null;
    return normalize(doc) as KhachThueData;
  }

  async findBySoDienThoai(sdt: string): Promise<(KhachThueData & { matKhau?: string }) | null> {
    await dbConnect();
    const doc = await KhachThueModel.findOne({ soDienThoai: sdt }).select('+matKhau');
    if (!doc) return null;
    return normalize(doc) as KhachThueData & { matKhau?: string };
  }

  async findMany(opts: QueryOptions): Promise<PaginatedResult<KhachThueData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.search) {
      filter.$or = [
        { hoTen: { $regex: opts.search, $options: 'i' } },
        { soDienThoai: { $regex: opts.search, $options: 'i' } },
        { cccd: { $regex: opts.search, $options: 'i' } },
        { email: { $regex: opts.search, $options: 'i' } },
      ];
    }

    const [docs, total] = await Promise.all([
      KhachThueModel.find(filter).select('-matKhau').skip(skip).limit(limit).sort({ ngayTao: -1 }),
      KhachThueModel.countDocuments(filter),
    ]);

    return {
      data: docs.map((d) => normalize(d) as KhachThueData),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateKhachThueInput): Promise<KhachThueData> {
    await dbConnect();
    const createData: any = {
      hoTen: data.hoTen,
      soDienThoai: data.soDienThoai,
      email: data.email,
      cccd: data.cccd,
      ngaySinh: data.ngaySinh,
      gioiTinh: data.gioiTinh,
      queQuan: data.queQuan,
      anhCCCD: data.anhCCCD,
      ngheNghiep: data.ngheNghiep,
    };
    if (data.matKhau) {
      createData.matKhau = data.matKhau;
    }
    const doc = await KhachThueModel.create(createData);
    const obj = normalize(doc);
    delete obj.matKhau;
    return obj as KhachThueData;
  }

  async update(id: string, data: UpdateKhachThueInput): Promise<KhachThueData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;

    if (data.matKhau !== undefined) {
      // Use save() to trigger pre-save hash hook
      const doc = await KhachThueModel.findById(id).select('+matKhau');
      if (!doc) return null;
      if (data.hoTen !== undefined) doc.hoTen = data.hoTen;
      if (data.soDienThoai !== undefined) doc.soDienThoai = data.soDienThoai;
      if (data.email !== undefined) doc.email = data.email;
      if (data.ngheNghiep !== undefined) doc.ngheNghiep = data.ngheNghiep;
      if (data.anhCCCD !== undefined) doc.anhCCCD = data.anhCCCD as any;
      if (data.trangThai !== undefined) doc.trangThai = data.trangThai;
      doc.matKhau = data.matKhau;
      await doc.save();
      const obj = normalize(doc);
      delete obj.matKhau;
      return obj as KhachThueData;
    }

    const updateFields: any = {};
    if (data.hoTen !== undefined) updateFields.hoTen = data.hoTen;
    if (data.soDienThoai !== undefined) updateFields.soDienThoai = data.soDienThoai;
    if (data.email !== undefined) updateFields.email = data.email;
    if (data.ngheNghiep !== undefined) updateFields.ngheNghiep = data.ngheNghiep;
    if (data.anhCCCD !== undefined) updateFields.anhCCCD = data.anhCCCD;
    if (data.trangThai !== undefined) updateFields.trangThai = data.trangThai;

    const doc = await KhachThueModel.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).select('-matKhau');
    if (!doc) return null;
    return normalize(doc) as KhachThueData;
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await KhachThueModel.findByIdAndDelete(id);
    return result !== null;
  }
}
