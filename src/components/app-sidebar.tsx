"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  Building2,
  DoorOpen,
  Users,
  FileText,
  Receipt,
  CreditCard,
  AlertTriangle,
  Bell,
  Settings,
  Shield,
  Home,
  Building,
  Globe,
  MessageCircle,
  Smartphone,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  
  // Tạo navigation items dựa trên role
  const navMain = React.useMemo(() => {
    const role = session?.user?.role

    // ── Nhân viên ─────────────────────────────────────────────────────────
    if (role === 'nhanVien') {
      return [
        {
          title: "Zalo",
          url: "#",
          icon: MessageCircle,
          isActive: true,
          items: [
            { title: "Zalo", url: "/dashboard/zalo" },
            { title: "Zalo Monitor", url: "/dashboard/zalo-monitor" },
          ],
        },
        {
          title: "Tài khoản",
          url: "#",
          icon: Users,
          items: [
            { title: "Hồ sơ", url: "/dashboard/ho-so" },
          ],
        },
      ]
    }

    // ── Admin: chỉ quản lý hệ thống — không quản lý phòng/khách/tài chính ─
    if (role === 'admin') {
      return [
        {
          title: "Hệ thống",
          url: "#",
          icon: Building,
          isActive: true,
          items: [
            { title: "Tòa nhà", url: "/dashboard/toa-nha" },
          ],
        },
        {
          title: "Quản trị",
          url: "#",
          icon: Shield,
          items: [
            { title: "Quản lý tài khoản", url: "/dashboard/quan-ly-tai-khoan" },
          ],
        },
        {
          title: "Zalo",
          url: "#",
          icon: MessageCircle,
          items: [
            { title: "Zalo", url: "/dashboard/zalo" },
            { title: "Zalo Monitor", url: "/dashboard/zalo-monitor" },
          ],
        },
        {
          title: "Cài đặt",
          url: "#",
          icon: Settings,
          items: [
            { title: "Hồ sơ", url: "/dashboard/ho-so" },
            { title: "Cài đặt", url: "/dashboard/cai-dat" },
          ],
        },
      ]
    }

    // ── Chủ trọ, Quản lý: đầy đủ tab quản lý bất động sản ───────────────
    const items = [
      {
        title: "Quản lý cơ bản",
        url: "#",
        icon: Building,
        isActive: true,
        items: [
          { title: "Tòa nhà", url: "/dashboard/toa-nha" },
          { title: "Phòng", url: "/dashboard/phong" },
          { title: "Khách thuê", url: "/dashboard/khach-thue" },
        ],
      },
      {
        title: "Tài chính",
        url: "#",
        icon: Receipt,
        items: [
          { title: "Hợp đồng", url: "/dashboard/hop-dong" },
          { title: "Hóa đơn", url: "/dashboard/hoa-don" },
          { title: "Thanh toán", url: "/dashboard/thanh-toan" },
        ],
      },
      {
        title: "Vận hành",
        url: "#",
        icon: AlertTriangle,
        items: [
          { title: "Sự cố", url: "/dashboard/su-co" },
          { title: "Yêu cầu duyệt", url: "/dashboard/yeu-cau-duyet" },
          { title: "Thông báo", url: "/dashboard/thong-bao" },
          { title: "Zalo", url: "/dashboard/zalo" },
          { title: "Zalo Monitor", url: "/dashboard/zalo-monitor" },
        ],
      },
    ]

    if (role === 'chuNha' || role === 'dongChuTro') {
      items.push({
        title: "Quản lý tài khoản",
        url: "#",
        icon: Users,
        items: [
          { title: "Quản lý tài khoản", url: "/dashboard/quan-ly-tai-khoan" },
        ],
      })
    }

    if (role === 'quanLy') {
      items.push({
        title: "Tài khoản",
        url: "#",
        icon: Users,
        items: [{ title: "Hồ sơ", url: "/dashboard/ho-so" }],
      })
    } else {
      items.push({
        title: "Cài đặt",
        url: "#",
        icon: Settings,
        items: [
          { title: "Hồ sơ", url: "/dashboard/ho-so" },
          { title: "Cài đặt", url: "/dashboard/cai-dat" },
        ],
      })
    }

    return items
  }, [session?.user?.role])

  const userData = React.useMemo(() => ({
    name: session?.user?.name || "User",
    email: session?.user?.email || "user@example.com",
    avatar: session?.user?.avatar || "/avatars/default.jpg",
  }), [session])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Building2 className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Phòng trọ</span>
                  <span className="truncate text-xs">Quản lý</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
