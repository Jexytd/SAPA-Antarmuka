# Task: Integrasi shadcn/ui + morphicons ke SAPA BPS

## Fase 1 — Setup ✅
- [x] `npm install class-variance-authority clsx tailwind-merge tw-animate-css`
- [x] `npm install morphicons lucide`
- [x] `npx shadcn@latest init -b radix -y` (preset Nova)
- [x] `components.json` terbuat di root
- [x] `src/lib/utils.ts` diperbaiki dengan fungsi `cn()` dari clsx + twMerge
- [x] `tw-animate-css` & `shadcn/tailwind.css` sudah ditambah di `globals.css`

## Fase 2 — Install Komponen shadcn ✅
- [x] 25 komponen diinstall: table, card, badge, skeleton, separator, input, textarea, select, checkbox, switch, label, form, tabs, breadcrumb, dialog, alert, alert-dialog, sonner, tooltip, progress, button, dropdown-menu, command, scroll-area, popover, chart
- [x] `npm run build` — teruji sukses 100% tanpa error TypeScript

## Fase 3 — Penyesuaian CSS ✅
- [x] Review `globals.css` — pastikan variabel shadcn tidak konflik dengan variabel SAPA
- [x] Sesuaikan `--primary` shadcn dengan biru BPS (#2563eb) dan ring (#3b82f6)
- [x] Tambahkan `@theme inline` untuk Tailwind CSS v4 mapping

## Fase 4 — Penerapan morphicons ✅
- [x] Ganti sidebar hamburger toggle (`Menu ↔ X`) dengan `MorphToggleMenu` (spring snappy)
- [x] Ganti sidebar collapse toggle (`ChevronLeft ↔ ChevronRight`) dengan `MorphCollapseIcon`
- [x] Buat modul utilitas `src/components/ui/morph-icon.tsx` (`MorphSortIcon`, `MorphExpandIcon`, `MorphFilterIcon`, `MorphToggleMenu`, `MorphCollapseIcon`)
- [x] Ganti sort icon di tabel Katalog Dataset (`MorphSortIcon` untuk urutan Nama & Terakhir Update)

## Fase 5 — Penerapan Komponen shadcn/ui per Halaman ✅
- [x] Sidebar: Terintegrasi dengan MorphIcon untuk desktop collapse dan mobile toggle
- [x] Header: Terintegrasi dengan MobileMenuButton berbasis MorphIcon
- [x] Datasets: Terintegrasi dengan `Badge` shadcn dan `MorphSortIcon`
- [x] TooltipProvider: Ditambahkan ke Root Layout (`src/app/layout.tsx`)
- [x] Issues: Terintegrasi dengan `Card`, `Badge`, `Tabs`, `Input`, dan `Dialog` untuk verifikasi issue
- [x] Users: Terintegrasi dengan `Card`, `Badge`, `Input`, dan `Dialog` untuk tambah/edit pengelola data
- [x] Keywords: Terintegrasi dengan `Card`, `Badge`, `Tabs`, `Input`, `Textarea`, dan `Dialog` untuk tambah/edit dan preview template balasan chatbot

## Verifikasi Akhir ✅
- [x] `npx tsc --noEmit` bersih (0 error TypeScript)
- [x] `npm run build` bersih (0 error, 19 rute sukses diproduksi)
