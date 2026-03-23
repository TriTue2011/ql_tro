import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getKhachThueRepo } from "@/lib/repositories";
import prisma from "@/lib/prisma";
import { z } from "zod";
import {
  sendMessageViaBotServer,
  sendImageViaBotServer,
  sendFileViaBotServer,
  sendVideoViaBotServer,
  getBotConfig,
  BotConfig,
} from "@/lib/zalo-bot-client";

const schema = z
  .object({
    phone: z.string().min(9, "Số điện thoại không hợp lệ").optional(),
    chatId: z.string().min(1).optional(),
    nguoiDungId: z.string().min(1).optional(), // ID của NguoiDung (chủ trọ/admin)
    message: z
      .string()
      .min(1, "Tin nhắn không được trống")
      .max(2000)
      .optional(),
    imageUrl: z.string().url("URL hình ảnh không hợp lệ").optional(),
    fileUrl: z.string().url("URL file không hợp lệ").optional(),
    videoUrl: z.string().url("URL video không hợp lệ").optional(),
    thumbnailUrl: z.string().url().optional(), // thumbnail cho video (tùy chọn)
    durationMs: z.number().int().positive().optional(), // thời lượng video (ms)
    threadType: z.union([z.literal(0), z.literal(1)]).optional(), // 0 = user (mặc định), 1 = group
    targetUserId: z.string().optional(), // ID của NguoiDung sở hữu tài khoản Zalo (để lấy bot config riêng)
  })
  .refine((d) => d.phone || d.chatId || d.nguoiDungId, {
    message: "Cần cung cấp phone, chatId hoặc nguoiDungId",
  })
  .refine((d) => d.message || d.imageUrl || d.fileUrl || d.videoUrl, {
    message: "Cần cung cấp message, imageUrl, fileUrl hoặc videoUrl",
  });

/** Lưu tin nhắn gửi đi vào DB (ZaloMessage) để có lịch sử */
async function logSentMessage(
  chatId: string,
  content: string,
  attachmentUrl?: string,
  ownId?: string,
) {
  try {
    await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId: ownId || null,
        content: content || "[media]",
        attachmentUrl: attachmentUrl || null,
        role: "bot",
        eventName: "send",
      },
    });
  } catch (e) {
    console.error("[gui-zalo] Lỗi lưu tin nhắn gửi đi:", e);
  }
}

/**
 * Thay localhost/127.0.0.1 trong URL bằng IP LAN (từ app_local_url)
 * để bot server bên ngoài có thể truy cập được MinIO/file URL.
 */
async function resolveLocalUrl(url: string): Promise<string> {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      const row = await prisma.caiDat.findFirst({
        where: { khoa: "app_local_url" },
      });
      const localUrl = row?.giaTri?.trim();
      if (localUrl) {
        const localParsed = new URL(localUrl);
        parsed.hostname = localParsed.hostname;
        // Giữ nguyên port của URL gốc (MinIO port khác app port)
        return parsed.toString();
      }
    }
  } catch {
    /* giữ nguyên URL nếu parse lỗi */
  }
  return url;
}

async function inferThreadType(
  chatId: string,
  explicitType?: 0 | 1,
): Promise<0 | 1> {
  if (explicitType !== undefined) return explicitType;
  try {
    const lastMsg = await prisma.zaloMessage.findFirst({
      where: { chatId },
      orderBy: { createdAt: "desc" },
      select: { rawPayload: true },
    });
    const raw = lastMsg?.rawPayload as any;
    return raw?.type === 1 ? 1 : 0;
  } catch {
    return 0;
  }
}

/** Tra cứu zaloChatId của khách thuê từ số điện thoại (chỉ khi bật nhận thông báo) */
async function resolveChatIdKhachThue(
  phone: string,
): Promise<{ chatId: string | null; disabled?: boolean }> {
  try {
    const repo = await getKhachThueRepo();
    const kt = await repo.findBySoDienThoai(phone);
    if (!kt) return { chatId: null };
    if (!kt.nhanThongBaoZalo) return { chatId: null, disabled: true };
    return { chatId: kt.zaloChatId ?? null };
  } catch {
    return { chatId: null };
  }
}

/** Tra cứu zaloChatId của NguoiDung (chủ trọ/admin/nhân viên) từ ID */
async function resolveChatIdNguoiDung(
  nguoiDungId: string,
): Promise<{ chatId: string | null; disabled?: boolean }> {
  try {
    const nd = await prisma.nguoiDung.findUnique({
      where: { id: nguoiDungId },
      select: { zaloChatId: true, nhanThongBaoZalo: true },
    });
    if (!nd) return { chatId: null };
    if (!nd.nhanThongBaoZalo) return { chatId: null, disabled: true };
    return { chatId: nd.zaloChatId ?? null };
  } catch {
    return { chatId: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: "Chưa đăng nhập" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message || "Dữ liệu không hợp lệ",
        },
        { status: 400 },
      );
    }

    const {
      phone,
      chatId: explicitChatId,
      nguoiDungId,
      message,
      imageUrl,
      fileUrl,
      videoUrl,
      thumbnailUrl,
      durationMs,
      threadType,
      targetUserId,
    } = parsed.data;

    // Resolve chat_id theo thứ tự ưu tiên: trực tiếp → khách thuê theo SĐT → người dùng theo ID
    let chatId = explicitChatId ?? null;
    if (!chatId && phone) {
      const result = await resolveChatIdKhachThue(phone);
      if (result.disabled) {
        return NextResponse.json(
          {
            success: false,
            message: `Khách thuê số ${phone} đã tắt nhận thông báo Zalo.`,
          },
          { status: 422 },
        );
      }
      chatId = result.chatId;
      if (!chatId) {
        return NextResponse.json(
          {
            success: false,
            message: `Chưa liên kết Zalo Chat ID cho số ${phone}. Vui lòng cập nhật trong hồ sơ khách thuê.`,
          },
          { status: 422 },
        );
      }
    }
    if (!chatId && nguoiDungId) {
      const result = await resolveChatIdNguoiDung(nguoiDungId);
      if (result.disabled) {
        return NextResponse.json(
          { success: false, message: `Người dùng đã tắt nhận thông báo Zalo.` },
          { status: 422 },
        );
      }
      chatId = result.chatId;
      if (!chatId) {
        return NextResponse.json(
          {
            success: false,
            message: `Người dùng chưa liên kết Zalo Chat ID. Vui lòng cập nhật trong hồ sơ.`,
          },
          { status: 422 },
        );
      }
    }
    if (!chatId) {
      return NextResponse.json(
        { success: false, message: "Thiếu chatId" },
        { status: 422 },
      );
    }

    const tType = await inferThreadType(chatId, threadType);

    // Lấy bot config riêng của target user (nếu có), fallback sang global
    const botUserId = targetUserId || session.user.id;
    const senderNd = await prisma.nguoiDung.findUnique({
      where: { id: botUserId },
      select: { zaloAccountId: true, zaloBotServerUrl: true, zaloBotUsername: true, zaloBotPassword: true, zaloBotTtl: true },
    });
    const accountSelection = senderNd?.zaloAccountId || undefined;

    let botConfig: BotConfig | null = null;
    if (senderNd?.zaloBotServerUrl) {
      botConfig = {
        serverUrl: senderNd.zaloBotServerUrl.replace(/\/$/, ''),
        username: senderNd.zaloBotUsername || 'admin',
        password: senderNd.zaloBotPassword || 'admin',
        accountId: senderNd.zaloAccountId || '',
        ttl: senderNd.zaloBotTtl ?? 0,
      };
    }
    if (!botConfig) {
      botConfig = await getBotConfig();
    }

    // Thay localhost trong URL bằng IP LAN để bot server (external) truy cập được
    const fixUrl = await resolveLocalUrl(
      imageUrl || fileUrl || videoUrl || "",
    );
    const fixedImageUrl = imageUrl ? fixUrl : undefined;
    const fixedFileUrl = fileUrl ? fixUrl : undefined;
    const fixedVideoUrl = videoUrl ? fixUrl : undefined;

    if (fixedVideoUrl) {
      const result = await sendVideoViaBotServer(chatId, fixedVideoUrl, {
        thumbnailUrl,
        durationMs,
        threadType: tType,
        accountSelection,
        configOverride: botConfig,
      });
      if (!result.ok)
        return NextResponse.json(
          { success: false, message: result.error || "Bot server lỗi khi gửi video." },
          { status: 502 },
        );
      await logSentMessage(chatId, message || "", fixedVideoUrl, accountSelection);
      return NextResponse.json({ success: true, message: "Đã gửi video Zalo thành công" });
    }
    if (fixedFileUrl) {
      const result = await sendFileViaBotServer(chatId, fixedFileUrl, message, tType, accountSelection, botConfig);
      if (!result.ok)
        return NextResponse.json(
          { success: false, message: result.error || "Bot server lỗi khi gửi file." },
          { status: 502 },
        );
      await logSentMessage(chatId, message || "", fixedFileUrl, accountSelection);
      return NextResponse.json({ success: true, message: "Đã gửi file Zalo thành công" });
    }
    if (fixedImageUrl) {
      const result = await sendImageViaBotServer(chatId, fixedImageUrl, message, tType, accountSelection, botConfig);
      if (!result.ok)
        return NextResponse.json(
          { success: false, message: result.error || "Bot server lỗi khi gửi ảnh." },
          { status: 502 },
        );
      await logSentMessage(chatId, message || "", fixedImageUrl, accountSelection);
      return NextResponse.json({ success: true, message: "Đã gửi hình ảnh Zalo thành công" });
    }
    const result = await sendMessageViaBotServer(chatId, message!, tType, accountSelection, botConfig);
    if (!result.ok)
      return NextResponse.json(
        { success: false, message: result.error || "Bot server lỗi khi gửi tin nhắn." },
        { status: 502 },
      );
    await logSentMessage(chatId, message!, undefined, accountSelection);
    return NextResponse.json({ success: true, message: "Đã gửi tin nhắn Zalo thành công" });
  } catch (error: any) {
    if (error?.name === "TimeoutError") {
      return NextResponse.json(
        { success: false, message: "Zalo API không phản hồi (timeout)." },
        { status: 504 },
      );
    }
    console.error("Error sending Zalo message:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi khi gửi tin nhắn Zalo" },
      { status: 500 },
    );
  }
}
