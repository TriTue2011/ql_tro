import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import NguoiDungModel from '@/models/NguoiDung';
import type {
  NguoiDungData,
  CreateNguoiDungInput,
  UpdateNguoiDungInput,
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

export default class NguoiDungRepository {
  async findById(id: string): Promise<NguoiDungData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await NguoiDungModel.findById(id).select('-matKhau -password');
    if (!doc) return null;
    return normalize(doc) as NguoiDungData;
  }

  async findByEmail(email: string): Promise<(NguoiDungData & { matKhau: string }) | null> {
    await dbConnect();
    const doc = await NguoiDungModel.findOne({ email: email.toLowerCase() });
    if (!doc) return null;
    return normalize(doc) as NguoiDungData & { matKhau: string };
  }

  async findMany(opts: QueryOptions): Promise<PaginatedResult<NguoiDungData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.search) {
      filter.$or = [
        { ten: { $regex: opts.search, $options: 'i' } },
        { email: { $regex: opts.search, $options: 'i' } },
      ];
    }

    const [docs, total] = await Promise.all([
      NguoiDungModel.find(filter).select('-matKhau -password').skip(skip).limit(limit).lean(),
      NguoiDungModel.countDocuments(filter),
    ]);

    return {
      data: docs.map((d) => normalize(d) as NguoiDungData),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateNguoiDungInput): Promise<NguoiDungData> {
    await dbConnect();
    const doc = await NguoiDungModel.create({
      ten: data.ten,
      name: data.ten,
      email: data.email,
      matKhau: data.matKhau,
      password: data.matKhau,
      soDienThoai: data.soDienThoai,
      phone: data.soDienThoai,
      vaiTro: data.vaiTro ?? 'nhanVien',
      role: data.vaiTro ?? 'nhanVien',
      anhDaiDien: data.anhDaiDien,
      avatar: data.anhDaiDien,
    });
    const obj = normalize(doc) as NguoiDungData & { matKhau?: string; password?: string };
    delete (obj as any).matKhau;
    delete (obj as any).password;
    return obj as NguoiDungData;
  }

  async update(id: string, data: UpdateNguoiDungInput): Promise<NguoiDungData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;

    const updateFields: any = {};
    if (data.ten !== undefined) { updateFields.ten = data.ten; updateFields.name = data.ten; }
    if (data.soDienThoai !== undefined) { updateFields.soDienThoai = data.soDienThoai; updateFields.phone = data.soDienThoai; }
    if (data.vaiTro !== undefined) { updateFields.vaiTro = data.vaiTro; updateFields.role = data.vaiTro; }
    if (data.anhDaiDien !== undefined) { updateFields.anhDaiDien = data.anhDaiDien; updateFields.avatar = data.anhDaiDien; }
    if (data.trangThai !== undefined) { updateFields.trangThai = data.trangThai; updateFields.isActive = data.trangThai === 'hoatDong'; }

    if (data.matKhau !== undefined) {
      // Need to use save() to trigger pre-save hook for hashing
      const doc = await NguoiDungModel.findById(id);
      if (!doc) return null;
      Object.assign(doc, updateFields);
      doc.matKhau = data.matKhau;
      doc.password = data.matKhau;
      await doc.save();
      const result = normalize(doc) as NguoiDungData & { matKhau?: string; password?: string };
      delete (result as any).matKhau;
      delete (result as any).password;
      return result as NguoiDungData;
    }

    const doc = await NguoiDungModel.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).select('-matKhau -password');
    if (!doc) return null;
    return normalize(doc) as NguoiDungData;
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await NguoiDungModel.findByIdAndDelete(id);
    return result !== null;
  }
}
