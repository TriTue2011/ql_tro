import mongoose, { Schema, Document } from 'mongoose';

export interface IThanhToan extends Document {
  hoaDon: mongoose.Types.ObjectId;
  soTien: number;
  phuongThuc: 'tienMat' | 'chuyenKhoan' | 'viDienTu';
  thongTinChuyenKhoan?: {
    nganHang: string;
    soGiaoDich: string;
  };
  ngayThanhToan: Date;
  nguoiNhan: mongoose.Types.ObjectId;
  ghiChu?: string;
  anhBienLai?: string;
  ngayTao: Date;
}

const ThongTinChuyenKhoanSchema = new Schema({
  nganHang: {
    type: String,
    required: [true, 'Ngân hàng là bắt buộc'],
    trim: true
  },
  soGiaoDich: {
    type: String,
    required: [true, 'Số giao dịch là bắt buộc'],
    trim: true
  }
}, { _id: false });

const ThanhToanSchema = new Schema<IThanhToan>({
  hoaDon: {
    type: Schema.Types.ObjectId,
    ref: 'HoaDon',
    required: [true, 'Hóa đơn là bắt buộc']
  },
  soTien: {
    type: Number,
    required: [true, 'Số tiền là bắt buộc'],
    min: [1, 'Số tiền phải lớn hơn 0']
  },
  phuongThuc: {
    type: String,
    enum: ['tienMat', 'chuyenKhoan', 'viDienTu'],
    required: [true, 'Phương thức thanh toán là bắt buộc']
  },
  thongTinChuyenKhoan: {
    type: ThongTinChuyenKhoanSchema,
    required: function() {
      return this.phuongThuc === 'chuyenKhoan';
    }
  },
  ngayThanhToan: {
    type: Date,
    required: [true, 'Ngày thanh toán là bắt buộc'],
    default: Date.now
  },
  nguoiNhan: {
    type: Schema.Types.ObjectId,
    ref: 'NguoiDung',
    required: [true, 'Người nhận là bắt buộc']
  },
  ghiChu: {
    type: String,
    trim: true,
    maxlength: [500, 'Ghi chú không được quá 500 ký tự']
  },
  anhBienLai: {
    type: String,
    trim: true
  }
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: false }
});

// Index cho tìm kiếm
ThanhToanSchema.index({ hoaDon: 1 });
ThanhToanSchema.index({ ngayThanhToan: 1 });
ThanhToanSchema.index({ nguoiNhan: 1 });
ThanhToanSchema.index({ phuongThuc: 1 });

export default mongoose.models.ThanhToan || mongoose.model<IThanhToan>('ThanhToan', ThanhToanSchema);
