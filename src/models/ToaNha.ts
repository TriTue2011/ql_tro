import mongoose, { Schema, Document } from 'mongoose';

export interface IToaNha extends Document {
  tenToaNha: string;
  diaChi: {
    soNha: string;
    duong: string;
    phuong: string;
    quan: string;
    thanhPho: string;
  };
  moTa?: string;
  anhToaNha: string[];
  chuSoHuu: mongoose.Types.ObjectId;
  tongSoPhong: number;
  tienNghiChung: string[];
  ngayTao: Date;
  ngayCapNhat: Date;
}

const DiaChiSchema = new Schema({
  soNha: {
    type: String,
    required: [true, 'Số nhà là bắt buộc'],
    trim: true
  },
  duong: {
    type: String,
    required: [true, 'Tên đường là bắt buộc'],
    trim: true
  },
  phuong: {
    type: String,
    required: [true, 'Phường/xã là bắt buộc'],
    trim: true
  },
  quan: {
    type: String,
    required: [true, 'Quận/huyện là bắt buộc'],
    trim: true
  },
  thanhPho: {
    type: String,
    required: [true, 'Thành phố là bắt buộc'],
    trim: true
  }
}, { _id: false });

const ToaNhaSchema = new Schema<IToaNha>({
  tenToaNha: {
    type: String,
    required: [true, 'Tên tòa nhà là bắt buộc'],
    trim: true,
    maxlength: [200, 'Tên tòa nhà không được quá 200 ký tự']
  },
  diaChi: {
    type: DiaChiSchema,
    required: [true, 'Địa chỉ là bắt buộc']
  },
  moTa: {
    type: String,
    trim: true,
    maxlength: [1000, 'Mô tả không được quá 1000 ký tự']
  },
  anhToaNha: [{
    type: String,
    trim: true
  }],
  chuSoHuu: {
    type: Schema.Types.ObjectId,
    ref: 'NguoiDung',
    required: [true, 'Chủ sở hữu là bắt buộc']
  },
  tongSoPhong: {
    type: Number,
    required: [true, 'Tổng số phòng là bắt buộc'],
    min: [0, 'Tổng số phòng không được âm'],
    default: 0
  },
  tienNghiChung: [{
    type: String,
    enum: ['wifi', 'camera', 'baoVe', 'giuXe', 'thangMay', 'sanPhoi', 'nhaVeSinhChung', 'khuBepChung'],
    trim: true
  }]
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' }
});

// Index cho tìm kiếm
ToaNhaSchema.index({ tenToaNha: 'text', 'diaChi.duong': 'text', 'diaChi.phuong': 'text' });
ToaNhaSchema.index({ chuSoHuu: 1 });

export default mongoose.models.ToaNha || mongoose.model<IToaNha>('ToaNha', ToaNhaSchema);
