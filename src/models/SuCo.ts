import mongoose, { Schema, Document } from 'mongoose';

export interface ISuCo extends Document {
  phong: mongoose.Types.ObjectId;
  khachThue: mongoose.Types.ObjectId;
  tieuDe: string;
  moTa: string;
  anhSuCo: string[];
  loaiSuCo: 'dienNuoc' | 'noiThat' | 'vesinh' | 'anNinh' | 'khac';
  mucDoUuTien: 'thap' | 'trungBinh' | 'cao' | 'khancap';
  trangThai: 'moi' | 'dangXuLy' | 'daXong' | 'daHuy';
  nguoiXuLy?: mongoose.Types.ObjectId;
  ghiChuXuLy?: string;
  ngayBaoCao: Date;
  ngayXuLy?: Date;
  ngayHoanThanh?: Date;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const SuCoSchema = new Schema<ISuCo>({
  phong: {
    type: Schema.Types.ObjectId,
    ref: 'Phong',
    required: [true, 'Phòng là bắt buộc']
  },
  khachThue: {
    type: Schema.Types.ObjectId,
    ref: 'KhachThue',
    required: [true, 'Khách thuê là bắt buộc']
  },
  tieuDe: {
    type: String,
    required: [true, 'Tiêu đề là bắt buộc'],
    trim: true,
    maxlength: [200, 'Tiêu đề không được quá 200 ký tự']
  },
  moTa: {
    type: String,
    required: [true, 'Mô tả là bắt buộc'],
    trim: true,
    maxlength: [1000, 'Mô tả không được quá 1000 ký tự']
  },
  anhSuCo: [{
    type: String,
    trim: true
  }],
  loaiSuCo: {
    type: String,
    enum: ['dienNuoc', 'noiThat', 'vesinh', 'anNinh', 'khac'],
    required: [true, 'Loại sự cố là bắt buộc']
  },
  mucDoUuTien: {
    type: String,
    enum: ['thap', 'trungBinh', 'cao', 'khancap'],
    default: 'trungBinh'
  },
  trangThai: {
    type: String,
    enum: ['moi', 'dangXuLy', 'daXong', 'daHuy'],
    default: 'moi'
  },
  nguoiXuLy: {
    type: Schema.Types.ObjectId,
    ref: 'NguoiDung'
  },
  ghiChuXuLy: {
    type: String,
    trim: true,
    maxlength: [500, 'Ghi chú xử lý không được quá 500 ký tự']
  },
  ngayBaoCao: {
    type: Date,
    required: [true, 'Ngày báo cáo là bắt buộc'],
    default: Date.now
  },
  ngayXuLy: {
    type: Date
  },
  ngayHoanThanh: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' }
});

// Index cho tìm kiếm
SuCoSchema.index({ phong: 1 });
SuCoSchema.index({ khachThue: 1 });
SuCoSchema.index({ loaiSuCo: 1 });
SuCoSchema.index({ mucDoUuTien: 1 });
SuCoSchema.index({ trangThai: 1 });
SuCoSchema.index({ ngayBaoCao: 1 });
SuCoSchema.index({ tieuDe: 'text', moTa: 'text' });

// Pre-save middleware để cập nhật ngày xử lý
SuCoSchema.pre('save', function(next) {
  if (this.isModified('trangThai')) {
    if (this.trangThai === 'dangXuLy' && !this.ngayXuLy) {
      this.ngayXuLy = new Date();
    } else if (this.trangThai === 'daXong' && !this.ngayHoanThanh) {
      this.ngayHoanThanh = new Date();
    }
  }
  next();
});

export default mongoose.models.SuCo || mongoose.model<ISuCo>('SuCo', SuCoSchema);
