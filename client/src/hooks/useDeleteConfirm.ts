import { useState, useCallback } from "react";

interface UseDeleteConfirmOptions {
  onDelete: (id: string) => void;
  confirmText?: string;
}

export function useDeleteConfirm({ onDelete, confirmText = "确定删除？" }: UseDeleteConfirmOptions) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const requestDelete = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (pendingDeleteId) {
      onDelete(pendingDeleteId);
      setPendingDeleteId(null);
    }
  }, [pendingDeleteId, onDelete]);

  const cancelDelete = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  const isConfirming = useCallback((id: string) => pendingDeleteId === id, [pendingDeleteId]);

  return {
    pendingDeleteId,
    requestDelete,
    confirmDelete,
    cancelDelete,
    isConfirming,
    confirmText,
  };
}
