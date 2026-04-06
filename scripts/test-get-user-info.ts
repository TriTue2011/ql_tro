#!/usr/bin/env npx tsx
/**
 * CLI kiểm tra getUserInfo theo Thread ID (chatId)
 *
 * Cách dùng:
 *   npx tsx scripts/test-get-user-info.ts <chatId> [accountSelection]
 *
 * Ví dụ:
 *   npx tsx scripts/test-get-user-info.ts 6643404425553198601
 *   npx tsx scripts/test-get-user-info.ts 6643404425553198601 +84947762285
 */

import { getUserInfoViaBotServer } from '../src/lib/zalo-bot-client';

async function main() {
  const chatId = process.argv[2];
  const accountSelection = process.argv[3] || undefined;

  if (!chatId) {
    console.error('❌ Thiếu chatId (Thread ID)');
    console.error('Cách dùng: npx tsx scripts/test-get-user-info.ts <chatId> [accountSelection]');
    console.error('Ví dụ:    npx tsx scripts/test-get-user-info.ts 6643404425553198601 +84947762285');
    process.exit(1);
  }

  console.log(`🔍 Đang lấy thông tin user chatId=${chatId}...`);
  if (accountSelection) console.log(`   Account: ${accountSelection}`);

  try {
    const info = await getUserInfoViaBotServer(chatId, accountSelection);

    if (!info.ok) {
      console.error('❌ Lỗi:', info.error);
      process.exit(1);
    }

    console.log('\n📦 Raw response:');
    console.log(JSON.stringify(info.data, null, 2));

    // Parse theo cấu trúc changed_profiles
    const d = info.data as any;
    const profile = d?.changed_profiles?.[chatId] ?? d;

    console.log('\n👤 Thông tin user:');
    console.log(`   Display Name : ${profile?.displayName ?? '(không có)'}`);
    console.log(`   Zalo Name    : ${profile?.zaloName ?? '(không có)'}`);
    console.log(`   Phone        : ${profile?.phoneNumber ?? profile?.phone ?? '(không có)'}`);
    console.log(`   Avatar       : ${profile?.avatar ?? '(không có)'}`);
    console.log(`   isFriend     : ${profile?.isFr ?? '(không rõ)'}`);
    console.log(`   userId       : ${profile?.userId ?? '(không có)'}`);

    // Chuẩn hóa SĐT
    let phone = profile?.phoneNumber || profile?.phone || '';
    if (phone) {
      phone = phone.replace(/^\+84/, '0').replace(/^84/, '0').replace(/\D/g, '');
      console.log(`\n📱 SĐT chuẩn hóa: ${phone}`);
    } else {
      console.log('\n⚠️  Không lấy được SĐT từ getUserInfo');
    }
  } catch (err: any) {
    console.error('❌ Exception:', err.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
