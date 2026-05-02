"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Edit,
  Trash2,
  Eye,
  MapPin,
  Building2,
  GripVertical,
  MoreVertical,
  Columns,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Home,
  Users,
  Search,
  Phone,
  User,
  ChevronUp,
} from "lucide-react"
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ToaNha } from '@/types'

// Helper functions
const formatAddress = (diaChi: ToaNha['diaChi']) => {
  return `${diaChi.soNha} ${diaChi.duong}, ${diaChi.phuong}, ${diaChi.thanhPho}`
}

// Create a separate component for the drag handle
function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({
    id,
  })

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="text-muted-foreground size-7 hover:bg-transparent"
    >
      <GripVertical className="text-muted-foreground size-3" />
      <span className="sr-only">Kéo để sắp xếp</span>
    </Button>
  )
}

type ToaNhaTableProps = {
  onView?: (toaNha: ToaNha) => void
  onEdit: (toaNha: ToaNha) => void
  onDelete: (id: string) => void
  canEdit?: boolean
}

const createColumns = (props: ToaNhaTableProps): ColumnDef<ToaNha>[] => [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id ?? row.original._id ?? ''} />,
    enableHiding: false,
  },
  {
    id: "select",
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Chọn tất cả"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Chọn hàng"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "tenToaNha",
    header: "Tên tòa nhà",
    cell: ({ row }) => (
      <div className="flex items-center gap-2 min-w-40">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{row.original.tenToaNha}</span>
      </div>
    ),
    enableHiding: false,
  },
  {
    accessorKey: "diaChi",
    header: "Địa chỉ",
    cell: ({ row }) => (
      <div className="flex items-center gap-2 min-w-64">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">{formatAddress(row.original.diaChi)}</span>
      </div>
    ),
  },
  {
    accessorKey: "tongSoPhong",
    header: () => <div className="text-center">Tổng phòng</div>,
    cell: ({ row }) => (
      <div className="text-center font-medium">
        {row.original.tongSoPhong}
      </div>
    ),
  },
  {
    id: "phongTrong",
    header: () => <div className="text-center">Phòng trống</div>,
    cell: ({ row }) => {
      const phongTrong = (row.original as any).phongTrong || 0
      const total = row.original.tongSoPhong
      const percentage = total > 0 ? Math.round((phongTrong / total) * 100) : 0
      return (
        <div className="text-center">
          <div className="font-medium text-green-600">{phongTrong}</div>
          <div className="text-xs text-muted-foreground">({percentage}%)</div>
        </div>
      )
    },
  },
  {
    id: "phongDangThue",
    header: () => <div className="text-center">Đang thuê</div>,
    cell: ({ row }) => {
      const phongDangThue = (row.original as any).phongDangThue || 0
      const total = row.original.tongSoPhong
      const percentage = total > 0 ? Math.round((phongDangThue / total) * 100) : 0
      return (
        <div className="text-center">
          <div className="font-medium text-blue-600">{phongDangThue}</div>
          <div className="text-xs text-muted-foreground">({percentage}%)</div>
        </div>
      )
    },
  },
  {
    accessorKey: "tienNghiChung",
    header: "Tiện nghi",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1 max-w-48">
        {row.original.tienNghiChung.slice(0, 2).map((tienNghi) => (
          <Badge key={tienNghi} variant="secondary" className="text-xs">
            {tienNghi}
          </Badge>
        ))}
        {row.original.tienNghiChung.length > 2 && (
          <Badge variant="outline" className="text-xs">
            +{row.original.tienNghiChung.length - 2}
          </Badge>
        )}
      </div>
    ),
  },
  {
    accessorKey: "ngayTao",
    header: "Ngày tạo",
    cell: ({ row }) => (
      <span className="text-sm">
        {new Date(row.original.ngayTao).toLocaleDateString('vi-VN')}
      </span>
    ),
  },
  ...(props.canEdit !== false ? [{
    id: "actions",
    cell: ({ row }: { row: Row<ToaNha> }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
            size="icon"
          >
            <MoreVertical className="size-4" />
            <span className="sr-only">Mở menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {props.onView && (
            <DropdownMenuItem onClick={() => props.onView!(row.original)}>
              <Eye className="mr-2 h-4 w-4" />
              Xem chi tiết
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => props.onEdit(row.original)}>
            <Edit className="mr-2 h-4 w-4" />
            Chỉnh sửa
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => props.onDelete(row.original.id ?? row.original._id ?? '')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Xóa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
    enableHiding: false,
  } as ColumnDef<ToaNha>] : []),
]

function DraggableRow({ row, isExpanded, onToggle }: { row: Row<ToaNha>; isExpanded: boolean; onToggle: (id: string) => void }) {
  const rowId = row.original.id ?? row.original._id ?? '';
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: rowId,
  })

  return (
    <>
      <TableRow
        data-state={row.getIsSelected() && "selected"}
        data-dragging={isDragging}
        ref={setNodeRef}
        className={`relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80 ${isExpanded ? 'bg-blue-50/50' : ''}`}
        style={{
          transform: CSS.Transform.toString(transform),
          transition: transition,
        }}
      >
        {row.getVisibleCells().map((cell) => {
          // Override the select column's checkbox to also toggle expand
          if (cell.column.id === 'select') {
            return (
              <TableCell key={cell.id}>
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={isExpanded}
                    onCheckedChange={() => onToggle(rowId)}
                    aria-label="Xem chi tiết"
                  />
                </div>
              </TableCell>
            )
          }
          return (
            <TableCell key={cell.id}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          )
        })}
      </TableRow>
      {isExpanded && (
        <TableRow className="hover:bg-inherit">
          <TableCell colSpan={row.getVisibleCells().length} className="p-0">
            <div className="border-t border-blue-200 bg-blue-50/30">
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-800 font-medium text-sm border-b border-blue-200 pb-2">
                  <Building2 className="h-4 w-4" />
                  Chi tiết tòa nhà
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Địa chỉ:</span>
                    <p className="font-medium mt-0.5">{formatAddress(row.original.diaChi)}</p>
                  </div>
                  
                  {row.original.moTa && (
                    <div>
                      <span className="text-gray-500">Mô tả:</span>
                      <p className="mt-0.5">{row.original.moTa}</p>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-gray-500">Chủ sở hữu:</span>
                    <p className="font-medium mt-0.5">
                      {typeof row.original.chuSoHuu === 'object' && row.original.chuSoHuu !== null
                        ? (row.original.chuSoHuu as any).ten || (row.original.chuSoHuu as any).id || 'N/A'
                        : row.original.chuSoHuu || 'N/A'}
                    </p>
                  </div>
                </div>
                
                {row.original.tienNghiChung && row.original.tienNghiChung.length > 0 && (
                  <div className="text-sm">
                    <span className="text-gray-500">Tiện nghi:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.original.tienNghiChung.map((tienNghi) => (
                        <Badge key={tienNghi} variant="secondary" className="text-xs">
                          {tienNghi}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {row.original.lienHePhuTrach && row.original.lienHePhuTrach.length > 0 && (
                  <div className="text-sm">
                    <span className="text-gray-500">Liên hệ phụ trách:</span>
                    <div className="space-y-1.5 mt-1">
                      {row.original.lienHePhuTrach.map((contact, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs bg-white/60 rounded-md p-2">
                          <User className="h-3.5 w-3.5 text-blue-500" />
                          <span className="font-medium">{contact.ten}</span>
                          {contact.soDienThoai && (
                            <span className="flex items-center gap-1 text-gray-600">
                              <Phone className="h-3 w-3" />{contact.soDienThoai}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-3 gap-2 text-center text-sm bg-white/60 rounded-md p-2">
                  <div>
                    <div className="text-gray-500 text-xs">Tổng phòng</div>
                    <div className="font-semibold">{row.original.tongSoPhong}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Phòng trống</div>
                    <div className="font-semibold text-green-600">{(row.original as any).phongTrong || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs">Đang thuê</div>
                    <div className="font-semibold text-blue-600">{(row.original as any).phongDangThue || 0}</div>
                  </div>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

type ToaNhaDataTableProps = ToaNhaTableProps & {
  data: ToaNha[]
  searchTerm?: string
  onSearchChange?: (value: string) => void
}

export function ToaNhaDataTable(props: ToaNhaDataTableProps) {
  const { data: initialData, searchTerm, onSearchChange, ...tableProps } = props
  const [data, setData] = React.useState(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  })
  
  // Sync data when prop changes
  React.useEffect(() => {
    setData(initialData)
  }, [initialData])
  
  const columns = React.useMemo(() => createColumns(tableProps), [tableProps])
  
  const sortableId = React.useId()
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map((row) => row.id ?? row._id ?? '') || [],
    [data]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id ?? row._id ?? '',
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id)
        const newIndex = dataIds.indexOf(over.id)
        return arrayMove(data, oldIndex, newIndex)
      })
    }
  }

  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Tìm kiếm bên trái */}
        <div className="flex-1 w-full sm:max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo tên, địa chỉ..."
              value={searchTerm || ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        {/* Tùy chỉnh cột bên phải */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="mr-2 h-4 w-4" />
                <span className="hidden lg:inline">Tùy chỉnh cột</span>
                <span className="lg:hidden">Cột</span>
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide()
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="overflow-hidden rounded-lg border">
        <DndContext
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
          id={sortableId}
        >
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="**:data-[slot=table-cell]:first:w-8">
              {table.getRowModel().rows?.length ? (
                <SortableContext
                  items={dataIds}
                  strategy={verticalListSortingStrategy}
                >
                  {table.getRowModel().rows.map((row) => (
                    <DraggableRow key={row.id} row={row} isExpanded={expandedId === row.original.id} onToggle={(id) => setExpandedId(expandedId === id ? null : id)} />
                  ))}
                </SortableContext>
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    Không có dữ liệu
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>
      
      <div className="flex items-center justify-between px-4">
        <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
          {selectedCount > 0 ? (
            <>Đã chọn {selectedCount} trong {table.getFilteredRowModel().rows.length} hàng</>
          ) : (
            <>Hiển thị {table.getFilteredRowModel().rows.length} hàng</>
          )}
        </div>
        <div className="flex w-full items-center gap-8 lg:w-fit">
          <div className="hidden items-center gap-2 lg:flex">
            <Label htmlFor="rows-per-page" className="text-sm font-medium">
              Số hàng mỗi trang
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Trang {table.getState().pagination.pageIndex + 1} /{" "}
            {table.getPageCount()}
          </div>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Trang đầu</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <span className="sr-only">Trang trước</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="size-8"
              size="icon"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Trang sau</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden size-8 lg:flex"
              size="icon"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <span className="sr-only">Trang cuối</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

