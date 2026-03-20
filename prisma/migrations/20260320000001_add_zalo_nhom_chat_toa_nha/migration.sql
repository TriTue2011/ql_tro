-- Add zaloNhomChat to ToaNha
-- JSON array: [{ tang?: number|null, threadId: string, label?: string }]
-- tang: null = toàn tòa, số = theo tầng
ALTER TABLE "ToaNha" ADD COLUMN IF NOT EXISTS "zaloNhomChat" JSONB NOT NULL DEFAULT '[]'::jsonb;
