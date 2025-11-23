'use client';

import { Trash2, Download, X } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: () => void;
  onExport?: () => void;
}

export default function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDelete,
  onExport,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-indigo-600 text-white rounded-lg shadow-2xl px-6 py-4 flex items-center gap-6">
        {/* Selection Count */}
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-full px-3 py-1">
            <span className="font-semibold">{selectedCount} selected</span>
          </div>

          {selectedCount < totalCount && (
            <button
              onClick={onSelectAll}
              className="text-sm hover:underline"
            >
              Select all {totalCount}
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-white/30"></div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}

          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClearSelection}
          className="p-2 hover:bg-white/10 rounded-md transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
