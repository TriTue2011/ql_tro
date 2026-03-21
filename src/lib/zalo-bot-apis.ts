/**
 * Danh sách toàn bộ endpoint của Zalo Bot Server.
 * Dùng để seed DB và làm whitelist cho proxy.
 * Source: tài liệu nội bộ smarthomeblack/zalobot
 */

export interface ZaloBotApiDef {
  endpoint: string;
  method: 'POST' | 'GET' | 'DELETE';
  nhom: string;
  tenNhom: string;
  moTa?: string;
  defaultPayload?: Record<string, unknown>;
  thuTu: number;
}

// ─── 1. Auth / Admin / Test ──────────────────────────────────────────────────
const AUTH_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/login',          method: 'POST', nhom: 'auth', tenNhom: 'Auth / Admin', moTa: 'Đăng nhập lấy token', defaultPayload: { username: 'admin', password: '' }, thuTu: 1 },
  { endpoint: '/api/users',          method: 'POST', nhom: 'auth', tenNhom: 'Auth / Admin', moTa: 'Quản lý users hệ thống', defaultPayload: {}, thuTu: 2 },
  { endpoint: '/api/change-password',method: 'POST', nhom: 'auth', tenNhom: 'Auth / Admin', moTa: 'Đổi mật khẩu', defaultPayload: { username: '', oldPassword: '', newPassword: '' }, thuTu: 3 },
  { endpoint: '/api/simple-login',   method: 'POST', nhom: 'auth', tenNhom: 'Auth / Admin', moTa: 'Đăng nhập đơn giản', defaultPayload: { username: '', password: '' }, thuTu: 4 },
  { endpoint: '/api/test-login',     method: 'POST', nhom: 'auth', tenNhom: 'Auth / Admin', moTa: 'Kiểm tra đăng nhập', defaultPayload: {}, thuTu: 5 },
  { endpoint: '/api/test-json',      method: 'POST', nhom: 'auth', tenNhom: 'Auth / Admin', moTa: 'Test JSON endpoint', defaultPayload: {}, thuTu: 6 },
];

// ─── 2. Zalo API cũ trực tiếp ────────────────────────────────────────────────
const ZALO_DIRECT_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/findUser',           method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Tìm người dùng Zalo', defaultPayload: { phone: '' }, thuTu: 1 },
  { endpoint: '/api/getUserInfo',        method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Lấy thông tin user', defaultPayload: { userId: '' }, thuTu: 2 },
  { endpoint: '/api/sendFriendRequest',  method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Gửi lời mời kết bạn', defaultPayload: { userId: '', msg: '' }, thuTu: 3 },
  { endpoint: '/api/sendmessage',        method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Gửi tin nhắn', defaultPayload: { threadId: '', msg: '', type: 0 }, thuTu: 4 },
  { endpoint: '/api/createGroup',        method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Tạo nhóm', defaultPayload: { name: '', members: [] }, thuTu: 5 },
  { endpoint: '/api/getGroupInfo',       method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Lấy thông tin nhóm', defaultPayload: { groupId: '' }, thuTu: 6 },
  { endpoint: '/api/addUserToGroup',     method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Thêm thành viên nhóm', defaultPayload: { groupId: '', userId: '' }, thuTu: 7 },
  { endpoint: '/api/removeUserFromGroup',method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Xóa thành viên nhóm', defaultPayload: { groupId: '', userId: '' }, thuTu: 8 },
  { endpoint: '/api/sendImageToUser',    method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Gửi ảnh đến user', defaultPayload: { userId: '', imageUrl: '' }, thuTu: 9 },
  { endpoint: '/api/sendImagesToUser',   method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Gửi nhiều ảnh đến user', defaultPayload: { userId: '', imageUrls: [] }, thuTu: 10 },
  { endpoint: '/api/sendImageToGroup',   method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Gửi ảnh vào nhóm', defaultPayload: { groupId: '', imageUrl: '' }, thuTu: 11 },
  { endpoint: '/api/sendImagesToGroup',  method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Gửi nhiều ảnh vào nhóm', defaultPayload: { groupId: '', imageUrls: [] }, thuTu: 12 },
  { endpoint: '/api/sendFile',           method: 'POST', nhom: 'zalo_direct', tenNhom: 'Zalo API trực tiếp', moTa: 'Gửi file', defaultPayload: { threadId: '', fileUrl: '', type: 0 }, thuTu: 13 },
];

// ─── 3. ByAccount cơ bản (khuyến nghị) ──────────────────────────────────────
const BY_ACCOUNT_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/findUserByAccount',          method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Tìm user theo số điện thoại', defaultPayload: { accountSelection: '', phone: '' }, thuTu: 1 },
  { endpoint: '/api/sendMessageByAccount',       method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Gửi tin nhắn văn bản', defaultPayload: { accountSelection: '', threadId: '', message: { msg: '', ttl: 0 }, type: 0 }, thuTu: 2 },
  { endpoint: '/api/sendImageByAccount',         method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Gửi ảnh từ URL', defaultPayload: { accountSelection: '', threadId: '', imageUrl: '', type: 0 }, thuTu: 3 },
  { endpoint: '/api/getUserInfoByAccount',       method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Lấy thông tin user', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 4 },
  { endpoint: '/api/sendFriendRequestByAccount', method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Gửi lời mời kết bạn', defaultPayload: { accountSelection: '', userId: '', msg: '' }, thuTu: 5 },
  { endpoint: '/api/createGroupByAccount',       method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Tạo nhóm', defaultPayload: { accountSelection: '', name: '', members: [] }, thuTu: 6 },
  { endpoint: '/api/getGroupInfoByAccount',      method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Lấy thông tin nhóm', defaultPayload: { accountSelection: '', groupId: '' }, thuTu: 7 },
  { endpoint: '/api/addUserToGroupByAccount',    method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Thêm thành viên nhóm', defaultPayload: { accountSelection: '', groupId: '', userId: '' }, thuTu: 8 },
  { endpoint: '/api/removeUserFromGroupByAccount',method:'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Xóa thành viên nhóm', defaultPayload: { accountSelection: '', groupId: '', memberId: '' }, thuTu: 9 },
  { endpoint: '/api/sendImageToUserByAccount',   method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Gửi ảnh đến user', defaultPayload: { accountSelection: '', userId: '', imageUrl: '' }, thuTu: 10 },
  { endpoint: '/api/sendImagesToUserByAccount',  method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Gửi nhiều ảnh đến user', defaultPayload: { accountSelection: '', userId: '', imageUrls: [] }, thuTu: 11 },
  { endpoint: '/api/sendImageToGroupByAccount',  method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Gửi ảnh vào nhóm', defaultPayload: { accountSelection: '', groupId: '', imageUrl: '' }, thuTu: 12 },
  { endpoint: '/api/sendImagesToGroupByAccount', method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Gửi nhiều ảnh vào nhóm', defaultPayload: { accountSelection: '', groupId: '', imageUrls: [] }, thuTu: 13 },
  { endpoint: '/api/sendFileByAccount',          method: 'POST', nhom: 'by_account', tenNhom: 'ByAccount — Cơ bản', moTa: 'Gửi file từ URL', defaultPayload: { accountSelection: '', threadId: '', fileUrl: '', type: 0 }, thuTu: 14 },
];

// ─── 4. Friend management ByAccount ─────────────────────────────────────────
const FRIEND_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/acceptFriendRequestByAccount',      method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Chấp nhận lời mời kết bạn', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 1 },
  { endpoint: '/api/blockUserByAccount',                method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Chặn user', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 2 },
  { endpoint: '/api/unblockUserByAccount',              method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Bỏ chặn user', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 3 },
  { endpoint: '/api/blockViewFeedByAccount',            method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Chặn xem feed', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 4 },
  { endpoint: '/api/changeFriendAliasByAccount',        method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Đổi biệt danh bạn bè', defaultPayload: { accountSelection: '', userId: '', alias: '' }, thuTu: 5 },
  { endpoint: '/api/removeFriendAliasByAccount',        method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Xóa biệt danh bạn bè', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 6 },
  { endpoint: '/api/getAllFriendsByAccount',             method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Lấy danh sách bạn bè', defaultPayload: { accountSelection: '', count: 200, page: 0 }, thuTu: 7 },
  { endpoint: '/api/getAliasListByAccount',             method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Lấy danh sách biệt danh', defaultPayload: { accountSelection: '' }, thuTu: 8 },
  { endpoint: '/api/getFriendRecommendationsByAccount', method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Gợi ý kết bạn', defaultPayload: { accountSelection: '' }, thuTu: 9 },
  { endpoint: '/api/getSentFriendRequestByAccount',     method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Lấy lời mời kết bạn đã gửi', defaultPayload: { accountSelection: '' }, thuTu: 10 },
  { endpoint: '/api/undoFriendRequestByAccount',        method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Thu hồi lời mời kết bạn', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 11 },
  { endpoint: '/api/removeFriendByAccount',             method: 'POST', nhom: 'friend', tenNhom: 'Friend Management', moTa: 'Xóa bạn bè', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 12 },
];

// ─── 5. Group management ByAccount ──────────────────────────────────────────
const GROUP_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/addGroupDeputyByAccount',      method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Thêm phó nhóm', defaultPayload: { accountSelection: '', groupId: '', userId: '' }, thuTu: 1 },
  { endpoint: '/api/removeGroupDeputyByAccount',   method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Xóa phó nhóm', defaultPayload: { accountSelection: '', groupId: '', userId: '' }, thuTu: 2 },
  { endpoint: '/api/changeGroupAvatarByAccount',   method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Đổi avatar nhóm', defaultPayload: { accountSelection: '', groupId: '', imageUrl: '' }, thuTu: 3 },
  { endpoint: '/api/changeGroupNameByAccount',     method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Đổi tên nhóm', defaultPayload: { accountSelection: '', groupId: '', name: '' }, thuTu: 4 },
  { endpoint: '/api/changeGroupOwnerByAccount',    method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Chuyển chủ nhóm', defaultPayload: { accountSelection: '', groupId: '', userId: '' }, thuTu: 5 },
  { endpoint: '/api/disperseGroupByAccount',       method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Giải tán nhóm', defaultPayload: { accountSelection: '', groupId: '' }, thuTu: 6 },
  { endpoint: '/api/enableGroupLinkByAccount',     method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Bật link mời nhóm', defaultPayload: { accountSelection: '', groupId: '' }, thuTu: 7 },
  { endpoint: '/api/disableGroupLinkByAccount',    method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Tắt link mời nhóm', defaultPayload: { accountSelection: '', groupId: '' }, thuTu: 8 },
  { endpoint: '/api/getAllGroupsByAccount',         method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Lấy danh sách nhóm', defaultPayload: { accountSelection: '' }, thuTu: 9 },
  { endpoint: '/api/getGroupLinkInfoByAccount',    method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Lấy thông tin link nhóm', defaultPayload: { accountSelection: '', groupId: '' }, thuTu: 10 },
  { endpoint: '/api/getGroupMembersInfoByAccount', method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Lấy thông tin thành viên', defaultPayload: { accountSelection: '', groupId: '' }, thuTu: 11 },
  { endpoint: '/api/inviteUserToGroupsByAccount',  method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Mời user vào nhóm', defaultPayload: { accountSelection: '', groupId: '', userId: '' }, thuTu: 12 },
  { endpoint: '/api/joinGroupByAccount',           method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Tham gia nhóm qua link', defaultPayload: { accountSelection: '', link: '' }, thuTu: 13 },
  { endpoint: '/api/leaveGroupByAccount',          method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Rời nhóm', defaultPayload: { accountSelection: '', groupId: '' }, thuTu: 14 },
  { endpoint: '/api/updateGroupSettingsByAccount', method: 'POST', nhom: 'group', tenNhom: 'Group Management', moTa: 'Cập nhật cài đặt nhóm', defaultPayload: { accountSelection: '', groupId: '', settings: {} }, thuTu: 15 },
];

// ─── 6. Message interaction ByAccount ───────────────────────────────────────
const MESSAGE_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/addReactionByAccount',         method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Thêm reaction', defaultPayload: { accountSelection: '', msgId: '', threadId: '', type: 1 }, thuTu: 1 },
  { endpoint: '/api/deleteMessageByAccount',       method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Xóa tin nhắn', defaultPayload: { accountSelection: '', msgId: '', threadId: '' }, thuTu: 2 },
  { endpoint: '/api/forwardMessageByAccount',      method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Chuyển tiếp tin nhắn', defaultPayload: { accountSelection: '', msgId: '', threadId: '', destThreadId: '' }, thuTu: 3 },
  { endpoint: '/api/parseLinkByAccount',           method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Parse thông tin link', defaultPayload: { accountSelection: '', url: '' }, thuTu: 4 },
  { endpoint: '/api/sendCardByAccount',            method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Gửi card liên hệ', defaultPayload: { accountSelection: '', threadId: '', userId: '', type: 0 }, thuTu: 5 },
  { endpoint: '/api/sendLinkByAccount',            method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Gửi tin nhắn link', defaultPayload: { accountSelection: '', threadId: '', url: '', type: 0 }, thuTu: 6 },
  { endpoint: '/api/sendStickerByAccount',         method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Gửi sticker', defaultPayload: { accountSelection: '', threadId: '', stickerId: '', stickerType: 0, type: 0 }, thuTu: 7 },
  { endpoint: '/api/getStickersByAccount',         method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Lấy danh sách sticker', defaultPayload: { accountSelection: '' }, thuTu: 8 },
  { endpoint: '/api/getStickersDetailByAccount',   method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Lấy chi tiết sticker', defaultPayload: { accountSelection: '', stickerId: '' }, thuTu: 9 },
  { endpoint: '/api/sendVideoByAccount',           method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Gửi video', defaultPayload: { accountSelection: '', threadId: '', type: 0, options: { videoUrl: '', duration: 10000, width: 1280, height: 720 } }, thuTu: 10 },
  { endpoint: '/api/sendVoiceByAccount',           method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Gửi tin nhắn thoại', defaultPayload: { accountSelection: '', threadId: '', voiceUrl: '', type: 0 }, thuTu: 11 },
  { endpoint: '/api/undoByAccount',                method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Thu hồi tin nhắn', defaultPayload: { accountSelection: '', msgId: '', threadId: '' }, thuTu: 12 },
  { endpoint: '/api/sendDeliveredEventByAccount',  method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Gửi sự kiện đã nhận', defaultPayload: { accountSelection: '', msgId: '', threadId: '' }, thuTu: 13 },
  { endpoint: '/api/sendSeenEventByAccount',       method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Gửi sự kiện đã đọc', defaultPayload: { accountSelection: '', msgId: '', threadId: '' }, thuTu: 14 },
  { endpoint: '/api/sendTypingEventByAccount',     method: 'POST', nhom: 'message', tenNhom: 'Message Interaction', moTa: 'Gửi sự kiện đang gõ', defaultPayload: { accountSelection: '', threadId: '', type: 0 }, thuTu: 15 },
];

// ─── 7. Board / Note / Poll / Reminder / Quick Message / Label ───────────────
const BOARD_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/createNoteByAccount',          method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Tạo ghi chú', defaultPayload: { accountSelection: '', groupId: '', content: '' }, thuTu: 1 },
  { endpoint: '/api/editNoteByAccount',            method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Sửa ghi chú', defaultPayload: { accountSelection: '', groupId: '', noteId: '', content: '' }, thuTu: 2 },
  { endpoint: '/api/getFriendBoardListByAccount',  method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Lấy board bạn bè', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 3 },
  { endpoint: '/api/getListBoardByAccount',        method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Lấy danh sách board', defaultPayload: { accountSelection: '' }, thuTu: 4 },
  { endpoint: '/api/createPollByAccount',          method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Tạo bình chọn nhóm', defaultPayload: { accountSelection: '', groupId: '', question: '', options: [] }, thuTu: 5 },
  { endpoint: '/api/getPollDetailByAccount',       method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Lấy chi tiết poll', defaultPayload: { accountSelection: '', pollId: '' }, thuTu: 6 },
  { endpoint: '/api/lockPollByAccount',            method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Khóa poll', defaultPayload: { accountSelection: '', pollId: '' }, thuTu: 7 },
  { endpoint: '/api/createReminderByAccount',      method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Tạo nhắc nhở', defaultPayload: { accountSelection: '', groupId: '', title: '', time: 0 }, thuTu: 8 },
  { endpoint: '/api/editReminderByAccount',        method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Sửa nhắc nhở', defaultPayload: { accountSelection: '', reminderId: '', title: '', time: 0 }, thuTu: 9 },
  { endpoint: '/api/removeReminderByAccount',      method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Xóa nhắc nhở', defaultPayload: { accountSelection: '', reminderId: '' }, thuTu: 10 },
  { endpoint: '/api/getReminderByAccount',         method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Lấy nhắc nhở', defaultPayload: { accountSelection: '', reminderId: '' }, thuTu: 11 },
  { endpoint: '/api/getListReminderByAccount',     method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Danh sách nhắc nhở', defaultPayload: { accountSelection: '', groupId: '' }, thuTu: 12 },
  { endpoint: '/api/getReminderResponsesByAccount',method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Phản hồi nhắc nhở', defaultPayload: { accountSelection: '', reminderId: '' }, thuTu: 13 },
  { endpoint: '/api/addQuickMessageByAccount',     method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Thêm tin nhắn nhanh', defaultPayload: { accountSelection: '', content: '' }, thuTu: 14 },
  { endpoint: '/api/getQuickMessageListByAccount', method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Danh sách tin nhắn nhanh', defaultPayload: { accountSelection: '' }, thuTu: 15 },
  { endpoint: '/api/removeQuickMessageByAccount',  method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Xóa tin nhắn nhanh', defaultPayload: { accountSelection: '', id: '' }, thuTu: 16 },
  { endpoint: '/api/updateQuickMessageByAccount',  method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Sửa tin nhắn nhanh', defaultPayload: { accountSelection: '', id: '', content: '' }, thuTu: 17 },
  { endpoint: '/api/getLabelsByAccount',           method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Lấy danh sách nhãn', defaultPayload: { accountSelection: '' }, thuTu: 18 },
  { endpoint: '/api/updateLabelsByAccount',        method: 'POST', nhom: 'board', tenNhom: 'Board / Note / Poll / Label', moTa: 'Cập nhật nhãn', defaultPayload: { accountSelection: '', threadId: '', labels: [] }, thuTu: 19 },
];

// ─── 8. Conversation management ──────────────────────────────────────────────
const CONVERSATION_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/addUnreadMarkByAccount',           method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Đánh dấu chưa đọc', defaultPayload: { accountSelection: '', threadId: '', type: 0 }, thuTu: 1 },
  { endpoint: '/api/removeUnreadMarkByAccount',        method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Bỏ đánh dấu chưa đọc', defaultPayload: { accountSelection: '', threadId: '', type: 0 }, thuTu: 2 },
  { endpoint: '/api/deleteChatByAccount',              method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Xóa cuộc trò chuyện', defaultPayload: { accountSelection: '', threadId: '', type: 0 }, thuTu: 3 },
  { endpoint: '/api/getArchivedChatListByAccount',     method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Lấy chat đã lưu trữ', defaultPayload: { accountSelection: '' }, thuTu: 4 },
  { endpoint: '/api/getAutoDeleteChatByAccount',       method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Lấy cài đặt tự xóa chat', defaultPayload: { accountSelection: '', threadId: '' }, thuTu: 5 },
  { endpoint: '/api/updateAutoDeleteChatByAccount',    method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Cập nhật tự xóa chat', defaultPayload: { accountSelection: '', threadId: '', duration: 0 }, thuTu: 6 },
  { endpoint: '/api/getHiddenConversationsByAccount',  method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Lấy chat ẩn', defaultPayload: { accountSelection: '' }, thuTu: 7 },
  { endpoint: '/api/setHiddenConversationsByAccount',  method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Ẩn cuộc trò chuyện', defaultPayload: { accountSelection: '', threadId: '', type: 0 }, thuTu: 8 },
  { endpoint: '/api/updateHiddenConversPinByAccount',  method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Cập nhật PIN ẩn', defaultPayload: { accountSelection: '', pin: '' }, thuTu: 9 },
  { endpoint: '/api/resetHiddenConversPinByAccount',   method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Đặt lại PIN ẩn', defaultPayload: { accountSelection: '' }, thuTu: 10 },
  { endpoint: '/api/getMuteByAccount',                 method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Lấy cài đặt tắt thông báo', defaultPayload: { accountSelection: '', threadId: '' }, thuTu: 11 },
  { endpoint: '/api/setMuteByAccount',                 method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Tắt thông báo', defaultPayload: { accountSelection: '', threadId: '', duration: 0 }, thuTu: 12 },
  { endpoint: '/api/getPinConversationsByAccount',     method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Lấy chat đã ghim', defaultPayload: { accountSelection: '' }, thuTu: 13 },
  { endpoint: '/api/setPinnedConversationsByAccount',  method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Ghim cuộc trò chuyện', defaultPayload: { accountSelection: '', threadId: '', type: 0 }, thuTu: 14 },
  { endpoint: '/api/getUnreadMarkByAccount',           method: 'POST', nhom: 'conversation', tenNhom: 'Conversation Management', moTa: 'Lấy danh sách chưa đọc', defaultPayload: { accountSelection: '' }, thuTu: 15 },
];

// ─── 9. Account profile / other ──────────────────────────────────────────────
const ACCOUNT_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/changeAccountAvatarByAccount', method: 'POST', nhom: 'account', tenNhom: 'Account Profile', moTa: 'Đổi avatar tài khoản', defaultPayload: { accountSelection: '', imageUrl: '' }, thuTu: 1 },
  { endpoint: '/api/deleteAvatarListByAccount',    method: 'POST', nhom: 'account', tenNhom: 'Account Profile', moTa: 'Xóa danh sách avatar', defaultPayload: { accountSelection: '', ids: [] }, thuTu: 2 },
  { endpoint: '/api/getAvatarListByAccount',       method: 'POST', nhom: 'account', tenNhom: 'Account Profile', moTa: 'Lấy danh sách avatar', defaultPayload: { accountSelection: '' }, thuTu: 3 },
  { endpoint: '/api/reuseAvatarByAccount',         method: 'POST', nhom: 'account', tenNhom: 'Account Profile', moTa: 'Dùng lại avatar cũ', defaultPayload: { accountSelection: '', id: '' }, thuTu: 4 },
  { endpoint: '/api/updateProfileByAccount',       method: 'POST', nhom: 'account', tenNhom: 'Account Profile', moTa: 'Cập nhật hồ sơ', defaultPayload: { accountSelection: '', name: '', dob: '' }, thuTu: 5 },
  { endpoint: '/api/updateLangByAccount',          method: 'POST', nhom: 'account', tenNhom: 'Account Profile', moTa: 'Cập nhật ngôn ngữ', defaultPayload: { accountSelection: '', lang: 'vi' }, thuTu: 6 },
  { endpoint: '/api/updateSettingsByAccount',      method: 'POST', nhom: 'account', tenNhom: 'Account Profile', moTa: 'Cập nhật cài đặt tài khoản', defaultPayload: { accountSelection: '', settings: {} }, thuTu: 7 },
  { endpoint: '/api/lastOnlineByAccount',          method: 'POST', nhom: 'account', tenNhom: 'Account Profile', moTa: 'Lấy thời gian online lần cuối', defaultPayload: { accountSelection: '', userId: '' }, thuTu: 8 },
  { endpoint: '/api/sendReportByAccount',          method: 'POST', nhom: 'account', tenNhom: 'Account Profile', moTa: 'Gửi báo cáo vi phạm', defaultPayload: { accountSelection: '', userId: '', reason: '' }, thuTu: 9 },
];

// ─── 10. Webhook ─────────────────────────────────────────────────────────────
const WEBHOOK_APIS: ZaloBotApiDef[] = [
  { endpoint: '/api/account-webhook', method: 'POST', nhom: 'webhook', tenNhom: 'Webhook Config', moTa: 'Cài đặt webhook nhận tin', defaultPayload: { ownId: '', messageWebhookUrl: '' }, thuTu: 1 },
];

export const ALL_ZALO_BOT_APIS: ZaloBotApiDef[] = [
  ...AUTH_APIS,
  ...ZALO_DIRECT_APIS,
  ...BY_ACCOUNT_APIS,
  ...FRIEND_APIS,
  ...GROUP_APIS,
  ...MESSAGE_APIS,
  ...BOARD_APIS,
  ...CONVERSATION_APIS,
  ...ACCOUNT_APIS,
  ...WEBHOOK_APIS,
];

/** Endpoint được phép gọi qua proxy (loại trừ auth/admin) */
export const PROXY_ALLOWED_NHOM = new Set([
  'zalo_direct', 'by_account', 'friend', 'group',
  'message', 'board', 'conversation', 'account', 'webhook',
]);
