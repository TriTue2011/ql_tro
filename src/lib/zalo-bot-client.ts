import prisma from "@/lib/prisma";

export interface BotConfig {
  serverUrl: string;
  username: string;
  password: string;
  accountId: string;
  ttl: number;
}

export interface BotCallResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

type ThreadType = 0 | 1 | "user" | "group";
type AuthHeaders = Record<string, string>;

type RequestConfig = {
  method: "GET" | "POST" | "DELETE";
  url: string;
  data?: unknown;
  timeout?: number;
  headers?: Record<string, string>;
};

export class ZaloBotClient {
  private readonly baseURL: string;
  private readonly timeout: number;
  private readonly headers: Record<string, string>;
  constructor({
    baseURL = "http://127.0.0.1:3000",
    timeout = 30_000,
    headers = {},
  }: {
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
  } = {}) {
    this.baseURL = baseURL.replace(/\/$/, "");
    this.timeout = timeout;
    this.headers = {
      "Content-Type": "application/json",
      ...headers,
    };
  }

  async request<T = unknown>(config: RequestConfig): Promise<T> {
    const res = await fetch(`${this.baseURL}${config.url}`, {
      method: config.method,
      headers: { ...this.headers, ...(config.headers ?? {}) },
      body: config.data === undefined ? undefined : JSON.stringify(config.data),
      signal: AbortSignal.timeout(config.timeout ?? this.timeout),
    });

    const raw = await res.text();
    const parsed = raw ? (() => {
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as T;
      }
    })() : (undefined as T);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${config.url}: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
    }

    return parsed;
  }

  // ===== Auth / account / server =====
  login(username: string, password: string) {
    return this.request<{ token?: string }>({
      method: "POST",
      url: "/api/login",
      data: { username, password },
      timeout: 10_000,
    });
  }

  getAccounts() {
    return this.request({ method: "GET", url: "/api/accounts", timeout: 10_000 });
  }

  getAccountDetails(ownId: string) {
    return this.request({ method: "GET", url: `/api/accounts/${ownId}`, timeout: 10_000 });
  }

  getAccountWebhooks() {
    return this.request({ method: "GET", url: "/api/account-webhooks", timeout: 10_000 });
  }

  getAccountWebhook(ownId: string) {
    return this.request({ method: "GET", url: `/api/account-webhook/${ownId}`, timeout: 10_000 });
  }

  setAccountWebhook({ ownId, messageWebhookUrl, groupEventWebhookUrl, reactionWebhookUrl }: {
    ownId: string;
    messageWebhookUrl?: string;
    groupEventWebhookUrl?: string;
    reactionWebhookUrl?: string;
  }) {
    return this.request({
      method: "POST",
      url: "/api/account-webhook",
      data: { ownId, messageWebhookUrl, groupEventWebhookUrl, reactionWebhookUrl },
      timeout: 15_000,
    });
  }

  deleteAccountWebhook(ownId: string) {
    return this.request({ method: "DELETE", url: `/api/account-webhook/${ownId}`, timeout: 10_000 });
  }

  getProxies() {
    return this.request({ method: "GET", url: "/api/proxies", timeout: 10_000 });
  }

  addProxy(proxyUrl: string) {
    return this.request({ method: "POST", url: "/api/proxies", data: { proxyUrl }, timeout: 10_000 });
  }

  removeProxy(proxyUrl: string) {
    return this.request({ method: "DELETE", url: "/api/proxies", data: { proxyUrl }, timeout: 10_000 });
  }

  getLoginQr() {
    return this.request({ method: "POST", url: "/zalo-login", timeout: 20_000 });
  }

  // ===== Messaging =====
  sendMessage({ message, threadId, accountSelection, type = 0, ttl = 0, quote }: {
    message: string;
    threadId: string;
    accountSelection: string;
    type?: ThreadType;
    ttl?: number;
    quote?: unknown;
  }) {
    return this.request({
      method: "POST",
      url: "/api/sendMessageByAccount",
      data: {
        message: { msg: message, ttl, quote: quote || null },
        threadId,
        accountSelection,
        type,
      },
      timeout: 15_000,
    });
  }

  sendFile({ fileUrl, threadId, accountSelection, type = "user", message = "", ttl = 0 }: {
    fileUrl: string;
    threadId: string;
    accountSelection: string;
    type?: ThreadType;
    message?: string;
    ttl?: number;
  }) {
    return this.request({
      method: "POST",
      url: "/api/sendFileByAccount",
      data: { fileUrl, message, threadId, accountSelection, type, ttl },
      timeout: 30_000,
    });
  }

  sendImage({ imagePath, threadId, accountSelection, type = "user", message = "", ttl = 0 }: {
    imagePath: string;
    threadId: string;
    accountSelection: string;
    type?: ThreadType;
    message?: string;
    ttl?: number;
  }) {
    return this.request({
      method: "POST",
      url: "/api/sendImageByAccount",
      data: { imagePath, threadId, accountSelection, type, ttl, message },
      timeout: 20_000,
    });
  }

  sendVideo({ threadId, accountSelection, type = 0, videoUrl, thumbnailUrl, message = "", duration = 10000, width = 1280, height = 720, ttl = 0 }: {
    threadId: string;
    accountSelection: string;
    type?: ThreadType;
    videoUrl: string;
    thumbnailUrl?: string;
    message?: string;
    duration?: number;
    width?: number;
    height?: number;
    ttl?: number;
  }) {
    return this.request({
      method: "POST",
      url: "/api/sendVideoByAccount",
      data: {
        threadId: String(threadId),
        accountSelection: String(accountSelection),
        type,
        options: {
          videoUrl,
          thumbnailUrl: thumbnailUrl || videoUrl,
          msg: message,
          duration,
          width,
          height,
          ttl,
        },
      },
      timeout: 60_000,
    });
  }

  sendSticker({ stickerId, threadId, accountSelection, type = 0 }: { stickerId: string | number; threadId: string; accountSelection: string; type?: ThreadType; }) {
    return this.request({
      method: "POST",
      url: "/api/sendStickerByAccount",
      data: {
        accountSelection,
        threadId,
        sticker: { id: Number(stickerId), cateId: 526, type: 1 },
        type,
      },
      timeout: 15_000,
    });
  }

  sendVoice({ threadId, accountSelection, voiceUrl }: { threadId: string; accountSelection: string; voiceUrl: string; }) {
    return this.request({
      method: "POST",
      url: "/api/sendVoiceByAccount",
      data: { threadId, accountSelection, options: { voiceUrl } },
      timeout: 30_000,
    });
  }

  sendTypingEvent({ threadId, accountSelection }: { threadId: string; accountSelection: string; }) {
    return this.request({ method: "POST", url: "/api/sendTypingEventByAccount", data: { threadId, accountSelection }, timeout: 10_000 });
  }
  sendImageToUser({ imagePath, threadId, accountSelection }: { imagePath: string; threadId: string; accountSelection: string; }) {
    return this.request({ method: "POST", url: "/api/sendImageToUserByAccount", data: { imagePath, threadId, accountSelection }, timeout: 20_000 });
  }
  sendImageToGroup({ imagePath, threadId, accountSelection }: { imagePath: string; threadId: string; accountSelection: string; }) {
    return this.request({ method: "POST", url: "/api/sendImageToGroupByAccount", data: { imagePath, threadId, accountSelection }, timeout: 20_000 });
  }
  sendImagesToUser({ imagePaths, threadId, accountSelection }: { imagePaths: string[]; threadId: string; accountSelection: string; }) {
    return this.request({ method: "POST", url: "/api/sendImagesToUserByAccount", data: { imagePaths, threadId, accountSelection }, timeout: 30_000 });
  }
  sendImagesToGroup({ imagePaths, threadId, accountSelection }: { imagePaths: string[]; threadId: string; accountSelection: string; }) {
    return this.request({ method: "POST", url: "/api/sendImagesToGroupByAccount", data: { imagePaths, threadId, accountSelection }, timeout: 30_000 });
  }

  // ===== User =====
  findUser({ phone, accountSelection }: { phone: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/findUserByAccount", data: { phone, accountSelection } }); }
  getUserInfo({ userId, accountSelection }: { userId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/getUserInfoByAccount", data: { userId, accountSelection } }); }
  sendFriendRequest({ userId, message, accountSelection }: { userId: string; message: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/sendFriendRequestByAccount", data: { userId, message, accountSelection } }); }
  acceptFriendRequest({ userId, accountSelection }: { userId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/acceptFriendRequestByAccount", data: { userId, accountSelection } }); }
  blockUser({ userId, accountSelection }: { userId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/blockUserByAccount", data: { userId, accountSelection } }); }
  unblockUser({ userId, accountSelection }: { userId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/unblockUserByAccount", data: { userId, accountSelection } }); }
  getAllFriends(accountSelection: string) { return this.request({ method: "POST", url: "/api/getAllFriendsByAccount", data: { accountSelection } }); }
  getReceivedFriendRequests(accountSelection: string) { return this.request({ method: "POST", url: "/api/getReceivedFriendRequestsByAccount", data: { accountSelection } }); }
  getSentFriendRequests(accountSelection: string) { return this.request({ method: "POST", url: "/api/getSentFriendRequestByAccount", data: { accountSelection } }); }
  undoFriendRequest({ friendId, accountSelection }: { friendId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/undoFriendRequestByAccount", data: { friendId, accountSelection } }); }
  removeFriend({ friendId, accountSelection }: { friendId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/removeFriendByAccount", data: { friendId, accountSelection } }); }
  changeFriendAlias({ friendId, alias, accountSelection }: { friendId: string; alias: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/changeFriendAliasByAccount", data: { friendId, alias, accountSelection } }); }
  removeFriendAlias({ friendId, accountSelection }: { friendId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/removeFriendAliasByAccount", data: { friendId, accountSelection } }); }
  updateProfile({ accountSelection, name, dob, gender }: { accountSelection: string; name?: string; dob?: string; gender?: number | string; }) {
    const payload: Record<string, unknown> = { accountSelection };
    if (name !== undefined) payload.name = name;
    if (dob !== undefined) payload.dob = dob;
    if (gender !== undefined) payload.gender = Number(gender);
    return this.request({ method: "POST", url: "/api/updateProfileByAccount", data: payload });
  }
  getAvatarList({ accountSelection, count, page }: { accountSelection: string; count?: number; page?: number; }) {
    const payload: Record<string, unknown> = { accountSelection };
    if (count !== undefined) payload.count = Number(count);
    if (page !== undefined) payload.page = Number(page);
    return this.request({ method: "POST", url: "/api/getAvatarListByAccount", data: payload });
  }
  lastOnline({ userId, accountSelection }: { userId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/lastOnlineByAccount", data: { userId, accountSelection } }); }

  // ===== Group =====
  createGroup({ members = [], name, avatarPath, accountSelection }: { members?: string[]; name: string; avatarPath?: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/createGroupByAccount", data: { members, name, avatarPath, accountSelection } }); }
  getGroupInfo({ groupId = [], accountSelection = "default" }: { groupId?: string[]; accountSelection?: string; }) { return this.request({ method: "POST", url: "/api/getGroupInfoByAccount", data: { groupId, accountSelection } }); }
  addUserToGroup({ groupId, memberId = [], accountSelection }: { groupId: string; memberId?: string[]; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/addUserToGroupByAccount", data: { groupId, memberId, accountSelection } }); }
  removeUserFromGroup({ groupId, memberId = [], accountSelection }: { groupId: string; memberId?: string[]; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/removeUserFromGroupByAccount", data: { groupId, memberId, accountSelection } }); }
  changeGroupName({ groupId, name, accountSelection }: { groupId: string; name: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/changeGroupNameByAccount", data: { groupId, name, accountSelection } }); }
  changeGroupAvatar({ groupId, imagePath, accountSelection }: { groupId: string; imagePath: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/changeGroupAvatarByAccount", data: { groupId, imagePath, accountSelection } }); }
  getAllGroups(accountSelection: string) { return this.request({ method: "POST", url: "/api/getAllGroupsByAccount", data: { accountSelection } }); }
  addGroupDeputy({ groupId, memberId, accountSelection }: { groupId: string; memberId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/addGroupDeputyByAccount", data: { groupId, memberId, accountSelection } }); }
  removeGroupDeputy({ groupId, memberId, accountSelection }: { groupId: string; memberId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/removeGroupDeputyByAccount", data: { groupId, memberId, accountSelection } }); }
  changeGroupOwner({ groupId, memberId, accountSelection }: { groupId: string; memberId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/changeGroupOwnerByAccount", data: { groupId, memberId, accountSelection } }); }
  disperseGroup({ groupId, accountSelection }: { groupId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/disperseGroupByAccount", data: { groupId, accountSelection } }); }
  enableGroupLink({ groupId, accountSelection }: { groupId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/enableGroupLinkByAccount", data: { groupId, accountSelection } }); }
  disableGroupLink({ groupId, accountSelection }: { groupId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/disableGroupLinkByAccount", data: { groupId, accountSelection } }); }
  joinGroup({ link, accountSelection }: { link: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/joinGroupByAccount", data: { link, accountSelection } }); }
  leaveGroup({ groupId, silent = false, accountSelection }: { groupId: string; silent?: boolean; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/leaveGroupByAccount", data: { groupId, silent, accountSelection } }); }
  createNoteGroup({ groupId, title, pinAct = true, accountSelection }: { groupId: string; title: string; pinAct?: boolean; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/createNoteGroupByAccount", data: { groupId, accountSelection, options: { title, pinAct } } }); }
  editNoteGroup({ groupId, topicId, title, accountSelection }: { groupId: string; topicId: string; title: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/editNoteGroupByAccount", data: { groupId, accountSelection, options: { topicId, title } } }); }
  getListBoard({ groupId, accountSelection }: { groupId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/getListBoardByAccount", data: { groupId, accountSelection } }); }
  createPoll({ groupId, question, options, allowMultiChoices = false, accountSelection }: { groupId: string; question: string; options: string[]; allowMultiChoices?: boolean; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/createPollByAccount", data: { groupId, accountSelection, options: { question, options, allowMultiChoices } } }); }
  getPollDetail({ pollId, accountSelection }: { pollId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/getPollDetailByAccount", data: { pollId, accountSelection } }); }
  lockPoll({ pollId, accountSelection }: { pollId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/lockPollByAccount", data: { pollId, accountSelection } }); }

  // ===== Reminder =====
  createReminder({ threadId, accountSelection, type = "0", title, content, remindTime }: { threadId: string; accountSelection: string; type?: string; title: string; content: string; remindTime: string | number; }) { return this.request({ method: "POST", url: "/api/createReminderByAccount", data: { threadId, accountSelection, type, options: { title, content, remindTime } } }); }
  removeReminder({ reminderId, threadId, accountSelection, type = "0" }: { reminderId: string; threadId: string; accountSelection: string; type?: string; }) { return this.request({ method: "POST", url: "/api/removeReminderByAccount", data: { reminderId, threadId, accountSelection, type } }); }
  editReminder({ threadId, topicId, title, accountSelection }: { threadId: string; topicId: string; title: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/editReminderByAccount", data: { threadId, topicId, title, accountSelection } }); }
  getReminder({ reminderId, accountSelection }: { reminderId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/getReminderByAccount", data: { reminderId, accountSelection } }); }
  getListReminder({ threadId, accountSelection, type }: { threadId: string; accountSelection: string; type: string; }) { return this.request({ method: "POST", url: "/api/getListReminderByAccount", data: { threadId, accountSelection, type } }); }
  getReminderResponses({ reminderId, accountSelection }: { reminderId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/getReminderResponsesByAccount", data: { reminderId, accountSelection } }); }

  // ===== Conversation utils =====
  undoMessage({ msgId, threadId, accountSelection, type = 0 }: { msgId: string; threadId: string; accountSelection: string; type?: ThreadType; }) { return this.request({ method: "POST", url: "/api/undoMessageByAccount", data: { msgId, threadId, accountSelection, type } }); }
  updateSettings({ accountSelection, type, status }: { accountSelection: string; type: string; status: number | string; }) { return this.request({ method: "POST", url: "/api/updateSettingsByAccount", data: { accountSelection, type, status: Number(status) } }); }
  setMute({ threadId, accountSelection, type = 0, duration = 0 }: { threadId: string; accountSelection: string; type?: ThreadType; duration?: number; }) { return this.request({ method: "POST", url: "/api/setMuteByAccount", data: { params: { action: Number(duration) > 0 ? "mute" : "unmute", duration: Number(duration) }, threadId, type, accountSelection } }); }
  setPinnedConversation({ threadId, pinned, accountSelection, type = 0 }: { threadId: string; pinned: boolean; accountSelection: string; type?: ThreadType; }) { return this.request({ method: "POST", url: "/api/setPinnedConversationsByAccount", data: { accountSelection, pinned: Boolean(pinned), threadId, type } }); }
  getUnreadMark(accountSelection: string) { return this.request({ method: "POST", url: "/api/getUnreadMarkByAccount", data: { accountSelection } }); }
  addUnreadMark({ threadId, accountSelection }: { threadId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/addUnreadMarkByAccount", data: { threadId, accountSelection } }); }
  removeUnreadMark({ threadId, accountSelection }: { threadId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/removeUnreadMarkByAccount", data: { threadId, accountSelection } }); }
  deleteChat({ threadId, accountSelection }: { threadId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/deleteChatByAccount", data: { threadId, accountSelection } }); }
  getArchivedChatList(accountSelection: string) { return this.request({ method: "POST", url: "/api/getArchivedChatListByAccount", data: { accountSelection } }); }
  getAutoDeleteChat(accountSelection: string) { return this.request({ method: "POST", url: "/api/getAutoDeleteChatByAccount", data: { accountSelection } }); }
  updateAutoDeleteChat({ threadId, ttl, accountSelection }: { threadId: string; ttl: number | string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/updateAutoDeleteChatByAccount", data: { threadId, ttl: Number(ttl), accountSelection } }); }
  getHiddenConversations(accountSelection: string) { return this.request({ method: "POST", url: "/api/getHiddenConversationsByAccount", data: { accountSelection } }); }
  setHiddenConversations({ threadId, isHide, accountSelection }: { threadId: string; isHide: boolean; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/setHiddenConversationsByAccount", data: { threadId, isHide: Boolean(isHide), accountSelection } }); }
  updateHiddenConversPin({ oldPin, newPin, accountSelection }: { oldPin: string; newPin: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/updateHiddenConversPinByAccount", data: { oldPin, newPin, accountSelection } }); }
  resetHiddenConversPin(accountSelection: string) { return this.request({ method: "POST", url: "/api/resetHiddenConversPinByAccount", data: { accountSelection } }); }
  getMute(accountSelection: string) { return this.request({ method: "POST", url: "/api/getMuteByAccount", data: { accountSelection } }); }
  getPinConversations(accountSelection: string) { return this.request({ method: "POST", url: "/api/getPinConversationsByAccount", data: { accountSelection } }); }
  addReaction({ icon, threadId, msgId, cliMsgId, type = "user", accountSelection }: { icon: string; threadId: string; msgId: string; cliMsgId?: string; type?: ThreadType; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/addReactionByAccount", data: { icon, threadId, msgId, cliMsgId, type, accountSelection } }); }
  deleteMessage({ threadId, msgId, cliMsgId, uidFrom, type = "user", onlyMe = true, accountSelection }: { threadId: string; msgId: string; cliMsgId?: string; uidFrom?: string; type?: ThreadType; onlyMe?: boolean; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/deleteMessageByAccount", data: { threadId, msgId, cliMsgId, uidFrom, type, onlyMe, accountSelection } }); }
  forwardMessage({ message, threadIds, type = "user", accountSelection }: { message: unknown; threadIds: string[]; type?: ThreadType; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/forwardMessageByAccount", data: { message, threadIds, type, accountSelection } }); }
  parseLink({ link, accountSelection }: { link: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/parseLinkByAccount", data: { link, accountSelection } }); }
  sendCard({ threadId, userId, accountSelection }: { threadId: string; userId: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/sendCardByAccount", data: { threadId, userId, accountSelection } }); }
  sendLink({ threadId, link, message = "", thumbnail = "", accountSelection }: { threadId: string; link: string; message?: string; thumbnail?: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/sendLinkByAccount", data: { threadId, link, message, thumbnail, accountSelection } }); }
  getLabels(accountSelection: string) { return this.request({ method: "POST", url: "/api/getLabelsByAccount", data: { accountSelection } }); }
  blockViewFeed({ userId, isBlockFeed, accountSelection }: { userId: string; isBlockFeed: boolean; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/blockViewFeedByAccount", data: { userId, isBlockFeed, accountSelection } }); }
  changeAccountAvatar({ avatarSource, accountSelection }: { avatarSource: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/changeAccountAvatarByAccount", data: { avatarSource, accountSelection } }); }

  // ===== Quick message =====
  addQuickMessage({ keyword, title, accountSelection }: { keyword: string; title: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/addQuickMessageByAccount", data: { accountSelection, addPayload: { keyword, title, message: { title, params: "" } } } }); }
  getQuickMessage(accountSelection: string) { return this.request({ method: "POST", url: "/api/getQuickMessageByAccount", data: { accountSelection } }); }
  removeQuickMessage({ itemIds, accountSelection }: { itemIds: string[]; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/removeQuickMessageByAccount", data: { accountSelection, itemIds } }); }
  updateQuickMessage({ itemId, keyword, title, accountSelection }: { itemId: string; keyword: string; title: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/updateQuickMessageByAccount", data: { accountSelection, itemId, updatePayload: { keyword, title, message: { title, params: "" } } } }); }

  // ===== Sticker =====
  getStickers({ query, accountSelection }: { query: string; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/getStickersByAccount", data: { query, accountSelection } }); }
  getStickersDetail({ stickerId, accountSelection }: { stickerId: string | number; accountSelection: string; }) { return this.request({ method: "POST", url: "/api/getStickersDetailByAccount", data: { stickerId, accountSelection } }); }
}

export async function getBotConfig(): Promise<BotConfig | null> {
  try {
    const rows = await prisma.caiDat.findMany({
      where: {
        khoa: {
          in: [
            "zalo_bot_server_url",
            "zalo_bot_username",
            "zalo_bot_password",
            "zalo_bot_account_id",
            "zalo_bot_ttl",
          ],
        },
      },
    });
    const map = Object.fromEntries(rows.map((row) => [row.khoa, row.giaTri?.trim() ?? ""]));
    const url = map.zalo_bot_server_url;
    if (!url) return null;
    return {
      serverUrl: url.replace(/\/$/, ""),
      username: map.zalo_bot_username || "admin",
      password: map.zalo_bot_password || "admin",
      accountId: map.zalo_bot_account_id || "",
      ttl: parseInt(map.zalo_bot_ttl || "0", 10) || 0,
    };
  } catch {
    return null;
  }
}

export async function isBotServerMode(): Promise<boolean> {
  try {
    const row = await prisma.caiDat.findFirst({ where: { khoa: "zalo_mode" } });
    return row?.giaTri?.trim() === "bot_server";
  } catch {
    return false;
  }
}

async function loginToBotServer(config: BotConfig): Promise<AuthHeaders | null> {
  try {
    const client = new ZaloBotClient({ baseURL: config.serverUrl, timeout: 10_000 });
    const body = await client.login(config.username, config.password).catch(() => null);
    if (body?.token) return { Authorization: `Bearer ${body.token}` };

    const res = await fetch(`${config.serverUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: config.username, password: config.password }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) return { Cookie: setCookie.split(";")[0] };
    return {};
  } catch {
    return null;
  }
}

function createAuthedClient(config: BotConfig, authHeaders: AuthHeaders) {
  return new ZaloBotClient({ baseURL: config.serverUrl, headers: authHeaders });
}

function resolveList<T = unknown>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== "object") return [];
  for (const key of keys) {
    const value = (data as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value as T[];
  }
  const nested = (data as Record<string, unknown>).data;
  if (Array.isArray(nested)) return nested as T[];
  if (nested && typeof nested === "object") {
    for (const key of keys) {
      const value = (nested as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

function requireAccountSelection(config: BotConfig, accountSelection?: string): string {
  const resolved = accountSelection ?? config.accountId;
  if (!resolved) {
    throw new Error(
      "Chưa cấu hình zalo_bot_account_id cho bot server",
    );
  }
  return resolved;
}

async function withBotClient<T>(handler: (ctx: { config: BotConfig; client: ZaloBotClient }) => Promise<T>): Promise<T> {
  const config = await getBotConfig();
  if (!config) throw new Error("Chưa cấu hình zalo_bot_server_url");
  const authHeaders = await loginToBotServer(config);
  if (!authHeaders) throw new Error("Không đăng nhập được bot server");
  const client = createAuthedClient(config, authHeaders);
  return handler({ config, client });
}

async function botCall<T>(handler: (ctx: { config: BotConfig; client: ZaloBotClient }) => Promise<T>): Promise<BotCallResult<T>> {
  try {
    const data = await withBotClient(handler);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Lỗi kết nối bot server" };
  }
}

export async function sendMessageViaBotServer(chatId: string, text: string, threadType: 0 | 1 = 0): Promise<BotCallResult> {
  return botCall(async ({ config, client }) => client.sendMessage({ message: text.length > 2000 ? `${text.slice(0, 1997)}...` : text, threadId: chatId, accountSelection: requireAccountSelection(config), type: threadType, ttl: config.ttl }));
}

export async function sendImageViaBotServer(chatId: string, imageUrl: string, caption?: string, threadType: 0 | 1 = 0): Promise<BotCallResult> {
  return botCall(async ({ config, client }) => client.sendImage({ imagePath: imageUrl, threadId: chatId, accountSelection: requireAccountSelection(config), type: threadType === 1 ? "group" : "user", message: caption?.slice(0, 1024) ?? "", ttl: config.ttl }));
}

export async function sendFileViaBotServer(chatId: string, fileUrl: string, caption?: string, threadType: 0 | 1 = 0): Promise<BotCallResult> {
  return botCall(async ({ config, client }) => client.sendFile({ fileUrl, threadId: chatId, accountSelection: requireAccountSelection(config), type: threadType === 1 ? "group" : "user", message: caption?.slice(0, 1024) ?? "", ttl: config.ttl }));
}

export async function sendVideoViaBotServer(chatId: string, videoUrl: string, opts?: { thumbnailUrl?: string; durationMs?: number; width?: number; height?: number; threadType?: 0 | 1; message?: string; }): Promise<BotCallResult> {
  return botCall(async ({ config, client }) => client.sendVideo({ threadId: chatId, accountSelection: requireAccountSelection(config), type: opts?.threadType ?? 0, videoUrl, thumbnailUrl: opts?.thumbnailUrl, message: opts?.message ?? "", duration: opts?.durationMs ?? 10000, width: opts?.width ?? 1280, height: opts?.height ?? 720, ttl: config.ttl }));
}

export async function getAccountsFromBotServer(): Promise<{ serverUrl: string; accounts: unknown[]; error?: string }> {
  const config = await getBotConfig();
  if (!config) return { serverUrl: "", accounts: [], error: "Chưa cấu hình zalo_bot_server_url" };
  const result = await botCall(async ({ client }) => client.getAccounts());
  return { serverUrl: config.serverUrl, accounts: result.ok ? resolveList(result.data, "accounts") : [], error: result.error };
}

export async function getQRCodeFromBotServer(accountSelection?: string): Promise<{ qrCode?: string; error?: string }> {
  const result = await botCall(async ({ client }) => client.request({ method: "POST", url: "/zalo-login", data: accountSelection ? { accountSelection } : undefined, timeout: 20_000 }));
  if (!result.ok) return { error: result.error };
  const data = result.data as Record<string, unknown> | undefined;
  const qrCode = typeof data?.qrCodeImage === "string" ? data.qrCodeImage : typeof data?.qrCode === "string" ? data.qrCode : typeof (data?.data as Record<string, unknown> | undefined)?.qrCodeImage === "string" ? ((data?.data as Record<string, string>).qrCodeImage) : typeof data?.image === "string" ? data.image : undefined;
  return qrCode ? { qrCode } : { error: "Bot server không trả về QR code — thử lại sau" };
}

export async function getAllFriendsFromBotServer(accountSelection?: string, count = 200, page = 0): Promise<{ ok: boolean; friends?: unknown[]; error?: string }> {
  const result = await botCall(async ({ config, client }) => client.request({ method: "POST", url: "/api/getAllFriendsByAccount", data: { accountSelection: requireAccountSelection(config, accountSelection), count, page } }));
  return result.ok ? { ok: true, friends: resolveList(result.data, "friends") } : { ok: false, error: result.error };
}

export async function getAllGroupsFromBotServer(accountSelection?: string): Promise<{ ok: boolean; groups?: unknown[]; error?: string }> {
  const result = await botCall(async ({ config, client }) => client.getAllGroups(requireAccountSelection(config, accountSelection)));
  return result.ok ? { ok: true, groups: resolveList(result.data, "groups") } : { ok: false, error: result.error };
}

export async function getGroupMembersFromBotServer(groupId: string, accountSelection?: string): Promise<{ ok: boolean; memberIds?: string[]; error?: string }> {
  const result = await botCall(async ({ config, client }) => client.request({ method: "POST", url: "/api/getGroupMembersInfoByAccount", data: { accountSelection: requireAccountSelection(config, accountSelection), groupId } }));
  if (!result.ok) return { ok: false, error: result.error };
  const members = resolveList<Record<string, unknown>>(result.data, "members", "memberInfos");
  const memberIds = members.map((member) => String(member.uid ?? member.id ?? member.userId ?? member.memberId ?? "")).filter(Boolean);
  return { ok: true, memberIds };
}

export async function removeUserFromGroupViaBotServer(groupId: string, memberId: string, accountSelection?: string): Promise<BotCallResult> {
  return botCall(async ({ config, client }) => client.removeUserFromGroup({ groupId, memberId: [memberId], accountSelection: requireAccountSelection(config, accountSelection) }));
}

export async function setWebhookOnBotServer(ownId: string, messageWebhookUrl: string, groupEventWebhookUrl?: string, reactionWebhookUrl?: string): Promise<BotCallResult> {
  return botCall(async ({ client }) => client.setAccountWebhook({ ownId, messageWebhookUrl, groupEventWebhookUrl, reactionWebhookUrl }));
}
