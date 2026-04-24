-- Thông báo có thể gửi kèm nhóm Zalo và file đính kèm
ALTER TABLE "ThongBao" ADD COLUMN IF NOT EXISTS "nhomChatIds" TEXT[] DEFAULT '{}';
ALTER TABLE "ThongBao" ADD COLUMN IF NOT EXISTS "fileDinhKem" TEXT[] DEFAULT '{}';
