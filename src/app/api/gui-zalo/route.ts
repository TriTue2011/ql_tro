import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getKhachThueRepo } from "@/lib/repositories";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { sseEmit } from "@/lib/sse-emitter";
import { emitNewMessage } from "@/lib/zalo-message-events";
import {
  sendMessageViaBotServer,
  sendImageViaBotServer,
  sendFileViaBotServer,
  sendVideoViaBotServer,
  getBotConfig,
  BotConfig,
} from "@/lib/zalo-bot-client";
import {
  sendMessage as directSendMessage,
  sendImage as directSendImage,
  sendFile as directSendFile,
  sendVideo as directSendVideo,
} from "@/lib/zalo-direct/service";

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
    imageUrl: z.string().min(1, "URL hình ảnh không hợp lệ").optional(),
    fileUrl: z.string().min(1, "URL file không hợp lệ").optional(),
    videoUrl: z.string().min(1, "URL video không hợp lệ").optional(),
    thumbnailUrl: z.string().min(1).optional(), // thumbnail cho video (tùy chọn)
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
    const saved = await prisma.zaloMessage.create({
      data: {
        chatId,
        ownId: ownId || null,
        content: content || "[media]",
        attachmentUrl: attachmentUrl || null,
        role: "bot",
        eventName: "send",
      },
    });
    // Emit real-time events để Monitor/Theo dõi tin cập nhật ngay
    emitNewMessage({ ...saved, eventName: saved.eventName ?? "send" });
    sseEmit("zalo-message", { chatId });
  } catch (e) {
    console.error("[gui-zalo] Lỗi lưu tin nhắn gửi đi:", e);
  }
}

/** Lấy base URL của app (từ DB hoặc env) */
async function getAppBaseUrl(): Promise<string> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: "app_local_url" } });
    if (row?.giaTri?.trim()) return row.giaTri.trim().replace(/\/$/, "");
  } catch { /* ignore */ }
  return process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

/**
 * Chuyển relative URL (/uploads/..., /api/files/...) thành absolute URL.
 * Sau đó thay localhost bằng IP LAN để bot server bên ngoài truy cập được.
 */
async function resolveLocalUrl(url: string): Promise<string> {
  if (!url) return url;

  // Relative path → absolute
  if (url.startsWith("/")) {
    const base = await getAppBaseUrl();
    return `${base}${url}`;
  }

  // Presigned MinIO URLs (có X-Amz-) — KHÔNG chạy qua URL parser để tránh hỏng signature
  if (url.includes("X-Amz-")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      const base = await getAppBaseUrl();
      try {
        const baseParsed = new URL(base);
        if (baseParsed.hostname !== "localhost" && baseParsed.hostname !== "127.0.0.1") {
          parsed.hostname = baseParsed.hostname;
          return parsed.toString();
        }
      } catch { /* ignore */ }
    }
    // Không cần sửa → trả nguyên URL gốc (tránh re-encode)
    return url;
  } catch {
    return url;
  }
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

    // Helper: thử gửi qua bot server, nếu thất bại (tài khoản không tồn tại) → fallback direct mode
    async function sendWithFallback(): Promise<{ ok: boolean; error?: string }> {
      // Thử bot server trước (nếu có config)
      let botResult: { ok: boolean; error?: string } | null = null;
      const hasBotServer = !!botConfig?.serverUrl;

      if (hasBotServer) {
        if (fixedVideoUrl) {
          botResult = await sendVideoViaBotServer(chatId!, fixedVideoUrl, {
            thumbnailUrl, durationMs, threadType: tType, accountSelection, configOverride: botConfig,
          });
        } else if (fixedFileUrl) {
          botResult = await sendFileViaBotServer(chatId!, fixedFileUrl, message, tType, accountSelection, botConfig);
        } else if (fixedImageUrl) {
          botResult = await sendImageViaBotServer(chatId!, fixedImageUrl, message, tType, accountSelection, botConfig);
        } else {
          botResult = await sendMessageViaBotServer(chatId!, message!, tType, accountSelection, botConfig);
        }

        // Nếu bot server thành công → trả về luôn
        if (botResult.ok) return botResult;

        // Nếu lỗi KHÔNG phải "không tìm thấy tài khoản" → trả lỗi luôn, không fallback
        const errLower = (botResult.error || "").toLowerCase();
        if (!errLower.includes("không tìm thấy tài khoản") && !errLower.includes("not found")) {
          return botResult;
        }
        // Fallback to direct mode below
      }

      // Direct mode (zca-js)
      if (fixedVideoUrl) {
        return directSendVideo(chatId!, {
          videoUrl: fixedVideoUrl, thumbnailUrl, msg: message, duration: durationMs,
        }, tType, accountSelection);
      } else if (fixedFileUrl) {
        return directSendFile(chatId!, fixedFileUrl, message, tType, 0, accountSelection);
      } else if (fixedImageUrl) {
        return directSendImage(chatId!, fixedImageUrl, message, tType, 0, accountSelection);
      } else {
        return directSendMessage(chatId!, message!, tType, 0, null, accountSelection);
      }
    }

    const result = await sendWithFallback();
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || "Lỗi gửi tin nhắn." },
        { status: 500 },
      );
    }

    const mediaUrl = fixedVideoUrl || fixedFileUrl || fixedImageUrl;
    await logSentMessage(chatId!, message || "", mediaUrl, accountSelection);

    const mediaLabel = fixedVideoUrl ? "video" : fixedFileUrl ? "file" : fixedImageUrl ? "hình ảnh" : "tin nhắn";
    return NextResponse.json({ success: true, message: `Đã gửi ${mediaLabel} Zalo thành công` });
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
