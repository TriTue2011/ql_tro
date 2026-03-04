import mongoose, { Schema, Document } from 'mongoose';

export interface IPhong extends Document {
  maPhong: string;
  toaNha: mongoose.Types.ObjectId;
  tang: number;
  dienTich: number;
  giaThue: number;
  tienCoc: number;
  moTa?: string;
  anhPhong: string[];
  tienNghi: string[];
  trangThai: 'trong' | 'daDat' | 'dangThue' | 'baoTri';
  soNguoiToiDa: number;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const PhongSchema = new Schema<IPhong>({
  maPhong: {
    type: String,
    required: [true, 'Mã phòng là bắt buộc'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9]+$/, 'Mã phòng chỉ được chứa chữ cái và số']
  },
  toaNha: {
    type: Schema.Types.ObjectId,
    ref: 'ToaNha',
    required: [true, 'Tòa nhà là bắt buộc']
  },
  tang: {
    type: Number,
    required: [true, 'Tầng là bắt buộc'],
    min: [0, 'Tầng phải lớn hơn hoặc bằng 0']
  },
  dienTich: {
    type: Number,
    required: [true, 'Diện tích là bắt buộc'],
    min: [1, 'Diện tích phải lớn hơn 0']
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
  moTa: {
    type: String,
    trim: true,
    maxlength: [1000, 'Mô tả không được quá 1000 ký tự']
  },
  anhPhong: [{
    type: String,
    trim: true
  }],
  tienNghi: [{
    type: String,
    enum: [
      'dieuhoa', 'nonglanh', 'tulanh', 'giuong', 'tuquanao', 'banlamviec', 
      'ghe', 'tivi', 'wifi', 'maygiat', 'bep', 'noi', 'chen', 'bat'
    ],
    trim: true
  }],
  trangThai: {
    type: String,
    enum: ['trong', 'daDat', 'dangThue', 'baoTri'],
    default: 'trong'
  },
  soNguoiToiDa: {
    type: Number,
    required: [true, 'Số người tối đa là bắt buộc'],
    min: [1, 'Số người tối đa phải lớn hơn 0'],
    max: [10, 'Số người tối đa không được quá 10']
  }
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' }
});

// Index cho tìm kiếm
// maPhong đã có unique: true nên không cần index thủ công
PhongSchema.index({ toaNha: 1 });
PhongSchema.index({ trangThai: 1 });
PhongSchema.index({ giaThue: 1 });
PhongSchema.index({ tang: 1 });

export default mongoose.models.Phong || mongoose.model<IPhong>('Phong', PhongSchema);
