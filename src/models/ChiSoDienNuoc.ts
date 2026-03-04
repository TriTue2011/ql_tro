import mongoose, { Schema, Document } from 'mongoose';

export interface IChiSoDienNuoc extends Document {
  phong: mongoose.Types.ObjectId;
  thang: number;
  nam: number;
  chiSoDienCu: number;
  chiSoDienMoi: number;
  soDienTieuThu: number;
  chiSoNuocCu: number;
  chiSoNuocMoi: number;
  soNuocTieuThu: number;
  anhChiSoDien?: string;
  anhChiSoNuoc?: string;
  nguoiGhi: mongoose.Types.ObjectId;
  ngayGhi: Date;
  ngayTao: Date;
}

const ChiSoDienNuocSchema = new Schema<IChiSoDienNuoc>({
  phong: {
    type: Schema.Types.ObjectId,
    ref: 'Phong',
    required: [true, 'Phòng là bắt buộc']
  },
  thang: {
    type: Number,
    required: [true, 'Tháng là bắt buộc'],
    min: [1, 'Tháng phải từ 1-12'],
    max: [12, 'Tháng phải từ 1-12']
  },
  nam: {
    type: Number,
    required: [true, 'Năm là bắt buộc'],
    min: [2020, 'Năm phải từ 2020 trở lên']
  },
  chiSoDienCu: {
    type: Number,
    required: [true, 'Chỉ số điện cũ là bắt buộc'],
    min: [0, 'Chỉ số điện cũ phải lớn hơn hoặc bằng 0']
  },
  chiSoDienMoi: {
    type: Number,
    required: [true, 'Chỉ số điện mới là bắt buộc'],
    min: [0, 'Chỉ số điện mới phải lớn hơn hoặc bằng 0']
  },
  soDienTieuThu: {
    type: Number,
    required: [true, 'Số điện tiêu thụ là bắt buộc'],
    min: [0, 'Số điện tiêu thụ phải lớn hơn hoặc bằng 0']
  },
  chiSoNuocCu: {
    type: Number,
    required: [true, 'Chỉ số nước cũ là bắt buộc'],
    min: [0, 'Chỉ số nước cũ phải lớn hơn hoặc bằng 0']
  },
  chiSoNuocMoi: {
    type: Number,
    required: [true, 'Chỉ số nước mới là bắt buộc'],
    min: [0, 'Chỉ số nước mới phải lớn hơn hoặc bằng 0']
  },
  soNuocTieuThu: {
    type: Number,
    required: [true, 'Số nước tiêu thụ là bắt buộc'],
    min: [0, 'Số nước tiêu thụ phải lớn hơn hoặc bằng 0']
  },
  anhChiSoDien: {
    type: String,
    trim: true
  },
  anhChiSoNuoc: {
    type: String,
    trim: true
  },
  nguoiGhi: {
    type: Schema.Types.ObjectId,
    ref: 'NguoiDung',
    required: [true, 'Người ghi là bắt buộc']
  },
  ngayGhi: {
    type: Date,
    required: [true, 'Ngày ghi là bắt buộc'],
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: false }
});

// Index cho tìm kiếm
ChiSoDienNuocSchema.index({ phong: 1, thang: 1, nam: 1 }, { unique: true });
ChiSoDienNuocSchema.index({ thang: 1, nam: 1 });
ChiSoDienNuocSchema.index({ nguoiGhi: 1 });

// Pre-save middleware để tính số tiêu thụ
ChiSoDienNuocSchema.pre('save', function(next) {
  if (this.isModified('chiSoDienMoi') || this.isModified('chiSoDienCu')) {
    this.soDienTieuThu = Math.max(0, this.chiSoDienMoi - this.chiSoDienCu);
  }
  
  if (this.isModified('chiSoNuocMoi') || this.isModified('chiSoNuocCu')) {
    this.soNuocTieuThu = Math.max(0, this.chiSoNuocMoi - this.chiSoNuocCu);
  }
  
  next();
});

export default mongoose.models.ChiSoDienNuoc || mongoose.model<IChiSoDienNuoc>('ChiSoDienNuoc', ChiSoDienNuocSchema);
