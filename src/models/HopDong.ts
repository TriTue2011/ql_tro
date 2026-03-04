import mongoose, { Schema, Document } from 'mongoose';

export interface IHopDong extends Document {
  maHopDong: string;
  phong: mongoose.Types.ObjectId;
  khachThueId: mongoose.Types.ObjectId[];
  nguoiDaiDien: mongoose.Types.ObjectId;
  ngayBatDau: Date;
  ngayKetThuc: Date;
  giaThue: number;
  tienCoc: number;
  chuKyThanhToan: 'thang' | 'quy' | 'nam';
  ngayThanhToan: number;
  dieuKhoan: string;
  giaDien: number;
  giaNuoc: number;
  chiSoDienBanDau: number;
  chiSoNuocBanDau: number;
  phiDichVu: Array<{
    ten: string;
    gia: number;
  }>;
  trangThai: 'hoatDong' | 'hetHan' | 'daHuy';
  fileHopDong?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const PhiDichVuSchema = new Schema({
  ten: {
    type: String,
    required: [true, 'Tên dịch vụ là bắt buộc'],
    trim: true
  },
  gia: {
    type: Number,
    required: [true, 'Giá dịch vụ là bắt buộc'],
    min: [0, 'Giá dịch vụ phải lớn hơn hoặc bằng 0']
  }
}, { _id: false });

const HopDongSchema = new Schema<IHopDong>({
  maHopDong: {
    type: String,
    required: [true, 'Mã hợp đồng là bắt buộc'],
    unique: true,
    trim: true,
    uppercase: true
  },
  phong: {
    type: Schema.Types.ObjectId,
    ref: 'Phong',
    required: [true, 'Phòng là bắt buộc']
  },
  khachThueId: [{
    type: Schema.Types.ObjectId,
    ref: 'KhachThue',
    required: [true, 'Khách thuê là bắt buộc']
  }],
  nguoiDaiDien: {
    type: Schema.Types.ObjectId,
    ref: 'KhachThue',
    required: [true, 'Người đại diện là bắt buộc']
  },
  ngayBatDau: {
    type: Date,
    required: [true, 'Ngày bắt đầu là bắt buộc']
  },
  ngayKetThuc: {
    type: Date,
    required: [true, 'Ngày kết thúc là bắt buộc']
  },
  giaThue: {
    type: Number,
    required: [true, 'Giá thuê là bắt buộc'],
    min: [0, 'Giá thuê phải lớn hơn hoặc bằng 0']
  },
  tienCoc: {
    type: Number,
    required: [true, 'Tiền cọc là bắt buộc'],
    min: [0, 'Tiền cọc phải lớn hơn hoặc bằng 0']
  },
  chuKyThanhToan: {
    type: String,
    enum: ['thang', 'quy', 'nam'],
    default: 'thang'
  },
  ngayThanhToan: {
    type: Number,
    required: [true, 'Ngày thanh toán là bắt buộc'],
    min: [1, 'Ngày thanh toán phải từ 1-31'],
    max: [31, 'Ngày thanh toán phải từ 1-31']
  },
  dieuKhoan: {
    type: String,
    required: [true, 'Điều khoản là bắt buộc'],
    trim: true
  },
  giaDien: {
    type: Number,
    required: [true, 'Giá điện là bắt buộc'],
    min: [0, 'Giá điện phải lớn hơn hoặc bằng 0']
  },
  giaNuoc: {
    type: Number,
    required: [true, 'Giá nước là bắt buộc'],
    min: [0, 'Giá nước phải lớn hơn hoặc bằng 0']
  },
  chiSoDienBanDau: {
    type: Number,
    required: [true, 'Chỉ số điện ban đầu là bắt buộc'],
    min: [0, 'Chỉ số điện ban đầu phải lớn hơn hoặc bằng 0']
  },
  chiSoNuocBanDau: {
    type: Number,
    required: [true, 'Chỉ số nước ban đầu là bắt buộc'],
    min: [0, 'Chỉ số nước ban đầu phải lớn hơn hoặc bằng 0']
  },
  phiDichVu: [PhiDichVuSchema],
  trangThai: {
    type: String,
    enum: ['hoatDong', 'hetHan', 'daHuy'],
    default: 'hoatDong'
  },
  fileHopDong: {
    type: String,
    trim: true
  }
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' }
});

// Index cho tìm kiếm
// maHopDong đã có unique: true nên không cần index thủ công
HopDongSchema.index({ phong: 1 });
HopDongSchema.index({ trangThai: 1 });
HopDongSchema.index({ ngayBatDau: 1 });
HopDongSchema.index({ ngayKetThuc: 1 });
HopDongSchema.index({ nguoiDaiDien: 1 });

// Validation: ngày kết thúc phải sau ngày bắt đầu
HopDongSchema.pre('save', function(next) {
  if (this.ngayKetThuc <= this.ngayBatDau) {
    next(new Error('Ngày kết thúc phải sau ngày bắt đầu'));
  } else {
    next();
  }
});

export default mongoose.models.HopDong || mongoose.model<IHopDong>('HopDong', HopDongSchema);
