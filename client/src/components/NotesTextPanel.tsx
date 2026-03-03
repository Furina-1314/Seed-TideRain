import { useGame, type NoteEntry } from "@/contexts/GameContext";
import { useState, useEffect, useRef } from "react";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { BookText, Plus, Edit2, Trash2, Check, X } from "lucide-react";

export default function NotesTextPanel() {
  const { state, dispatch } = useGame();
  const [isAdding, setIsAdding] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const addFormRef = useRef<HTMLDivElement>(null);

  // 删除确认
  const { requestDelete, confirmDelete, cancelDelete, isConfirming } = useDeleteConfirm({
    onDelete: (id) => dispatch({ type: "DELETE_NOTE", payload: id }),
    confirmText: "确定删除这条笔记？",
  });

  const handleAdd = () => {
    if (!newContent.trim()) return;
    dispatch({ type: "ADD_NOTE", payload: { content: newContent.trim() } });
    setNewContent("");
    setIsAdding(false);
  };

  const startEdit = (note: NoteEntry) => {
    setEditingId(note.id);
    setEditingContent(note.content);
  };

  const saveEdit = () => {
    if (!editingId || !editingContent.trim()) return;
    dispatch({ type: "UPDATE_NOTE", payload: { id: editingId, content: editingContent.trim() } });
    setEditingId(null);
    setEditingContent("");
  };

  // 点击外部取消添加
  useEffect(() => {
    if (!isAdding) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addFormRef.current && !addFormRef.current.contains(e.target as Node)) {
        setIsAdding(false);
        setNewContent("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAdding]);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg h-full flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center">
            <BookText size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">笔记</h3>
            <p className="text-[10px] text-gray-500">{state.notes.length} 条记录</p>
          </div>
        </div>
        <button onClick={() => setIsAdding(true)} className="p-2 rounded-xl bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors">
          <Plus size={18} />
        </button>
      </div>

      {isAdding && (
        <div ref={addFormRef} className="mb-3 bg-gray-50 rounded-xl p-3 shrink-0">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="输入笔记内容..."
            rows={5}
            autoFocus
            className="w-full bg-white rounded-lg px-3 py-2 text-sm resize-none border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => { setIsAdding(false); setNewContent(""); }} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-200">取消</button>
            <button onClick={handleAdd} className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium">保存</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {state.notes.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">还没有笔记，点击右上角新建</div>
        ) : (
          state.notes.map((note) => (
            <div key={note.id} className="bg-gray-50 rounded-xl p-3">
              {editingId === note.id ? (
                <>
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    rows={6}
                    className="w-full bg-white rounded-lg px-3 py-2 text-sm resize-none border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200"><X size={14} /></button>
                    <button onClick={saveEdit} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50"><Check size={14} /></button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{note.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-gray-400">创建于 {new Date(note.createdAt).toLocaleString("zh-CN")}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(note)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"><Edit2 size={14} /></button>
                      {isConfirming(note.id) ? (
                        <div className="flex items-center gap-0.5">
                          <span className="text-[10px] text-gray-500">确定？</span>
                          <button onClick={confirmDelete} className="p-1 rounded text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
                          <button onClick={cancelDelete} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={12} /></button>
                        </div>
                      ) : (
                        <button onClick={() => requestDelete(note.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
