import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import ToaNhaModel from '@/models/ToaNha';
import type {
  ToaNhaData,
  CreateToaNhaInput,
  UpdateToaNhaInput,
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

function normalizeToaNha(doc: any): ToaNhaData {
  const obj = normalize(doc);
  if (obj.chuSoHuu && typeof obj.chuSoHuu === 'object') {
    const populated = normalize(obj.chuSoHuu);
    obj.chuSoHuuId = populated.id;
    obj.chuSoHuu = populated;
  } else if (obj.chuSoHuu) {
    obj.chuSoHuuId = obj.chuSoHuu.toString();
    obj.chuSoHuu = undefined;
  }
  return obj as ToaNhaData;
}

export default class ToaNhaRepository {
  async findById(id: string): Promise<ToaNhaData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await ToaNhaModel.findById(id).populate('chuSoHuu', 'ten email');
    if (!doc) return null;
    return normalizeToaNha(doc);
  }

  async findMany(opts: QueryOptions): Promise<PaginatedResult<ToaNhaData>> {
    await dbConnect();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.max(1, opts.limit ?? 20);
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (opts.search) {
      filter.$or = [
        { tenToaNha: { $regex: opts.search, $options: 'i' } },
        { 'diaChi.duong': { $regex: opts.search, $options: 'i' } },
        { 'diaChi.phuong': { $regex: opts.search, $options: 'i' } },
      ];
    }

    const [docs, total] = await Promise.all([
      ToaNhaModel.find(filter).populate('chuSoHuu', 'ten email').skip(skip).limit(limit),
      ToaNhaModel.countDocuments(filter),
    ]);

    return {
      data: docs.map(normalizeToaNha),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateToaNhaInput): Promise<ToaNhaData> {
    await dbConnect();
    const doc = await ToaNhaModel.create({
      tenToaNha: data.tenToaNha,
      diaChi: data.diaChi,
      moTa: data.moTa,
      anhToaNha: data.anhToaNha ?? [],
      chuSoHuu: new mongoose.Types.ObjectId(data.chuSoHuuId),
      tongSoPhong: data.tongSoPhong ?? 0,
      tienNghiChung: data.tienNghiChung ?? [],
    });
    await doc.populate('chuSoHuu', 'ten email');
    return normalizeToaNha(doc);
  }

  async update(id: string, data: UpdateToaNhaInput): Promise<ToaNhaData | null> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return null;

    const updateFields: any = {};
    if (data.tenToaNha !== undefined) updateFields.tenToaNha = data.tenToaNha;
    if (data.diaChi !== undefined) {
      for (const [k, v] of Object.entries(data.diaChi)) {
        if (v !== undefined) updateFields[`diaChi.${k}`] = v;
      }
    }
    if (data.moTa !== undefined) updateFields.moTa = data.moTa;
    if (data.anhToaNha !== undefined) updateFields.anhToaNha = data.anhToaNha;
    if (data.tongSoPhong !== undefined) updateFields.tongSoPhong = data.tongSoPhong;
    if (data.tienNghiChung !== undefined) updateFields.tienNghiChung = data.tienNghiChung;

    const doc = await ToaNhaModel.findByIdAndUpdate(id, { $set: updateFields }, { new: true }).populate('chuSoHuu', 'ten email');
    if (!doc) return null;
    return normalizeToaNha(doc);
  }

  async delete(id: string): Promise<boolean> {
    await dbConnect();
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await ToaNhaModel.findByIdAndDelete(id);
    return result !== null;
  }

  async count(filter?: object): Promise<number> {
    await dbConnect();
    return ToaNhaModel.countDocuments(filter ?? {});
  }
}
