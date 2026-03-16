// Layout bảo vệ khu vực khách thuê.
// Việc kiểm tra auth đã được xử lý tại middleware.ts (NextAuth session).
// Layout này chỉ render children, không cần kiểm tra localStorage nữa.
export default function KhachThueLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
