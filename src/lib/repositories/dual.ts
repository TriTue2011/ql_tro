/**
 * Dual-Write Repository Wrapper
 *
 * Ghi song song vào cả 2 database:
 *   - Primary (PostgreSQL): ghi trước, chờ kết quả, trả về cho client
 *   - Secondary (MongoDB): ghi sau, fire-and-forget (không block, log lỗi nếu fail)
 *
 * Reads luôn từ Primary.
 *
 * Dùng khi DATABASE_PROVIDER=both
 */

const WRITE_METHODS = new Set(['create', 'update', 'delete']);

export function createDualWriteRepo<T extends object>(primary: T, secondary: T): T {
  return new Proxy(primary, {
    get(target, prop: string) {
      const primaryMethod = (target as any)[prop];
      if (typeof primaryMethod !== 'function') return primaryMethod;

      if (!WRITE_METHODS.has(prop)) {
        // Reads & other methods → forward to primary only
        return primaryMethod.bind(target);
      }

      // Mutation methods → write to primary, then fire-and-forget to secondary
      return async (...args: any[]) => {
        const result = await primaryMethod.apply(target, args);

        const secondaryMethod = (secondary as any)[prop];
        if (typeof secondaryMethod === 'function') {
          secondaryMethod.apply(secondary, args).catch((err: Error) => {
            console.error(`[DualWrite] Secondary "${prop}" failed:`, err.message);
          });
        }

        return result;
      };
    },
  }) as T;
}
