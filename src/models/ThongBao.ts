import mongoose, { Schema, Document } from 'mongoose';

export interface IThongBao extends Document {
  tieuDe: string;
  noiDung: string;
  loai: 'chung' | 'hoaDon' | 'suCo' | 'hopDong' | 'khac';
  nguoiGui: mongoose.Types.ObjectId;
  nguoiNhan: mongoose.Types.ObjectId[];
  phong?: mongoose.Types.ObjectId[];
  toaNha?: mongoose.Types.ObjectId;
  daDoc: mongoose.Types.ObjectId[];
  ngayGui: Date;
  ngayTao: Date;
}

const ThongBaoSchema = new Schema<IThongBao>({
  tieuDe: {
    type: String,
    required: [true, 'Tiêu đề là bắt buộc'],
    trim: true,
    maxlength: [200, 'Tiêu đề không được quá 200 ký tự']
  },
  noiDung: {
    type: String,
    required: [true, 'Nội dung là bắt buộc'],
    trim: true,
    maxlength: [2000, 'Nội dung không được quá 2000 ký tự']
  },
  loai: {
    type: String,
    enum: ['chung', 'hoaDon', 'suCo', 'hopDong', 'khac'],
    default: 'chung'
  },
  nguoiGui: {
    type: Schema.Types.ObjectId,
    ref: 'NguoiDung',
    required: [true, 'Người gửi là bắt buộc']
  },
  nguoiNhan: [{
    type: Schema.Types.ObjectId,
    required: [true, 'Người nhận là bắt buộc']
  }],
  phong: [{
    type: Schema.Types.ObjectId,
    ref: 'Phong'
  }],
  toaNha: {
    type: Schema.Types.ObjectId,
    ref: 'ToaNha'
  },
  daDoc: [{
    type: Schema.Types.ObjectId
  }],
  ngayGui: {
    type: Date,
    required: [true, 'Ngày gửi là bắt buộc'],
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: false }
});

// Index cho tìm kiếm
ThongBaoSchema.index({ nguoiGui: 1 });
ThongBaoSchema.index({ ngayGui: -1 });
ThongBaoSchema.index({ loai: 1 });
ThongBaoSchema.index({ tieuDe: 'text', noiDung: 'text' });

export default mongoose.models.ThongBao || mongoose.model<IThongBao>('ThongBao', ThongBaoSchema);
