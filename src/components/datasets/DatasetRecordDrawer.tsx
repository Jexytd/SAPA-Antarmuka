'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { InputField } from '@/components/ui';
import { RecordRepo, validateRecord } from '@/lib/repository';
import { Dataset, DataStatus, AnomalyWarning, ValidationError } from '@/lib/types';
import {
  AlertTriangle,
  Check,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface DatasetRecordDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  dataset: Dataset;
  user: { id: string; name: string } | null;
  onRecordAdded?: (recordId: string) => void;
}

export default function DatasetRecordDrawer({
  isOpen,
  onClose,
  dataset,
  user,
  onRecordAdded,
}: DatasetRecordDrawerProps) {
  const periodRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    indicator: dataset.name,
    region: dataset.geographic_scope || 'Kabupaten Bangka',
    period: '',
    value: '',
    unit: dataset.unit || '',
    source: dataset.source || 'BPS Kabupaten Bangka',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [anomalyWarning, setAnomalyWarning] = useState<AnomalyWarning | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset or initialize form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setForm({
        indicator: dataset.name,
        region: dataset.geographic_scope || 'Kabupaten Bangka',
        period: '',
        value: '',
        unit: dataset.unit || '',
        source: dataset.source || 'BPS Kabupaten Bangka',
        notes: '',
      });
      setErrors({});
      setAnomalyWarning(null);

      // Autofocus ke input periode setelah animasi sheet terbuka
      setTimeout(() => {
        periodRef.current?.focus();
      }, 200);
    }
  }, [isOpen, dataset]);

  // Check anomalies when value changes
  const handleValueChange = (val: string) => {
    setForm((prev) => ({ ...prev, value: val }));
    if (errors.value) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.value;
        return next;
      });
    }

    const num = parseFloat(val.replace(/,/g, '.'));
    if (!isNaN(num) && form.indicator) {
      const anomaly = RecordRepo.checkAnomalies(
        dataset.id,
        form.indicator,
        form.region || dataset.geographic_scope || 'Kabupaten Bangka',
        num
      );
      setAnomalyWarning(anomaly || null);
    } else {
      setAnomalyWarning(null);
    }
  };

  const handleSave = async (stayOpen = false) => {
    if (!user) {
      toast.error('Sesi login telah berakhir. Silakan masuk kembali.');
      return;
    }

    const numValue = form.value.trim() === '' ? null : parseFloat(form.value.replace(/,/g, '.'));

    if (numValue === null || isNaN(numValue)) {
      setErrors((prev) => ({ ...prev, value: 'Nilai angka harus berupa angka valid.' }));
      return;
    }

    const recordData = {
      dataset_id: dataset.id,
      indicator: form.indicator.trim() || dataset.name,
      region: form.region.trim() || dataset.geographic_scope || 'Kabupaten Bangka',
      period: form.period.trim(),
      value: numValue,
      unit: form.unit.trim() || dataset.unit,
      source: form.source.trim() || dataset.source,
      notes: form.notes.trim() || '',
      status: DataStatus.DRAFT,
      created_by: user.id,
      updated_by: user.id,
    };

    const validationErrors = validateRecord(recordData, dataset.id);
    const fieldErrors: Record<string, string> = {};
    const warnings: ValidationError[] = [];

    validationErrors.forEach((err) => {
      if (err.severity === 'error') {
        fieldErrors[err.field] = err.message;
      } else {
        warnings.push(err);
      }
    });

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSaving(true);
    try {
      const created = RecordRepo.create(recordData, user.name);

      toast.success(
        `Data ${recordData.indicator} (${recordData.period}: ${numValue.toLocaleString('id-ID')} ${recordData.unit}) berhasil disimpan ke draf.`
      );

      onRecordAdded?.(created.id);

      if (stayOpen) {
        // Kosongkan period & value untuk entri periode berikutnya
        setForm((prev) => ({
          ...prev,
          period: '',
          value: '',
          notes: '',
        }));
        setErrors({});
        setAnomalyWarning(null);
        setTimeout(() => {
          periodRef.current?.focus();
        }, 100);
      } else {
        onClose();
      }
    } catch {
      toast.error('Gagal menyimpan data statistik. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        {/* Header Drawer */}
        <SheetHeader className="px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {dataset.code}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {dataset.category}
            </span>
          </div>
          <SheetTitle className="text-base font-bold text-slate-900">
            Tambah Baris Data
          </SheetTitle>
          <SheetDescription className="text-xs text-slate-500 line-clamp-1">
            Entri angka statistik untuk dataset <strong>{dataset.name}</strong>
          </SheetDescription>
        </SheetHeader>

        {/* Body Drawer (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Indikator */}
          <div>
            <InputField
              label="Nama Indikator"
              id="indicator"
              required
              value={form.indicator}
              onChange={(e) => {
                setForm((p) => ({ ...p, indicator: e.target.value }));
                if (errors.indicator) {
                  setErrors((p) => {
                    const n = { ...p };
                    delete n.indicator;
                    return n;
                  });
                }
              }}
              error={errors.indicator}
              placeholder="Nama indikator"
            />
          </div>

          {/* Wilayah & Periode dalam 2 Kolom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <InputField
              label="Wilayah"
              id="region"
              required
              value={form.region}
              onChange={(e) => {
                setForm((p) => ({ ...p, region: e.target.value }));
                if (errors.region) {
                  setErrors((p) => {
                    const n = { ...p };
                    delete n.region;
                    return n;
                  });
                }
              }}
              error={errors.region}
              placeholder="Contoh: Kabupaten Bangka"
            />

            <InputField
              label="Periode / Tahun"
              id="period"
              required
              ref={periodRef}
              value={form.period}
              onChange={(e) => {
                setForm((p) => ({ ...p, period: e.target.value }));
                if (errors.period) {
                  setErrors((p) => {
                    const n = { ...p };
                    delete n.period;
                    return n;
                  });
                }
              }}
              error={errors.period}
              placeholder="Contoh: 2025 atau 2025-Q1"
              hint="Tahun atau periode waktu"
            />
          </div>

          {/* Nilai Angka & Satuan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <InputField
                label="Nilai Angka"
                id="value"
                required
                value={form.value}
                onChange={(e) => handleValueChange(e.target.value)}
                error={errors.value}
                placeholder="Contoh: 14500 atau 78.45"
                hint="Gunakan titik (.) untuk desimal"
              />
            </div>
            <div>
              <InputField
                label="Satuan"
                id="unit"
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                placeholder="Satuan"
              />
            </div>
          </div>

          {/* Deteksi Anomali Angka */}
          {anomalyWarning && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-xs leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                Peringatan Anomali Data ({anomalyWarning.change_percent > 0 ? '+' : ''}{anomalyWarning.change_percent.toFixed(1)}%)
              </div>
              <p>{anomalyWarning.message}</p>
            </div>
          )}

          {/* Sumber Data */}
          <InputField
            label="Sumber Data"
            id="source"
            value={form.source}
            onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
            placeholder="Sumber data statistik resmi"
          />

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Catatan Metodologi / Keterangan (Opsional)
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Catatan khusus, angka sementara, atau revisi metodologi..."
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
            />
          </div>
        </div>

        {/* Footer Drawer */}
        <SheetFooter className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={saving}
            className="text-xs text-slate-600 hover:text-slate-900"
          >
            Batal
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => handleSave(true)}
              className="text-xs border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              title="Simpan baris ini dan lanjutkan entri periode berikutnya"
            >
              {saving ? (
                <RefreshCw size={13} className="mr-1 animate-spin" />
              ) : (
                <Plus size={13} className="mr-1" />
              )}
              Simpan & Tambah Lagi
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={saving}
              onClick={() => handleSave(false)}
              className="text-xs font-medium"
            >
              {saving ? (
                <RefreshCw size={13} className="mr-1 animate-spin" />
              ) : (
                <Check size={13} className="mr-1" />
              )}
              Simpan Data
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
