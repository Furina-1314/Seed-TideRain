//待办页
import { useGame, type MemoEntry } from "@/contexts/GameContext";
import { useState, useEffect, useRef } from "react";
import { useDeleteConfirm } from "@/hooks/useDeleteConfirm";
import { Plus, Trash2, Lightbulb, Check, Edit2, Search, X, Tag } from "lucide-react";

const PRIORITY_CONFIG = {
  low: { label: "低", color: "text-blue-600", bg: "bg-blue-100", border: "border-blue-300", icon: "🔵" },
  medium: { label: "中", color: "text-amber-600", bg: "bg-amber-100", border: "border-amber-300", icon: "🟡" },
  high: { label: "高", color: "text-red-600", bg: "bg-red-100", border: "border-red-300", icon: "🔴" },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function formatDateTime(iso: string) {
  return new Date(iso)
    .toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(/\//g, "-");
}

function toDateTimeLocalValue(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function NotesPanel() {
  const { state, dispatch } = useGame();
  const [newContent, setNewContent] = useState("");
  const [newTag, setNewTag] = useState<string>("");
  const [newPriority, setNewPriority] = useState<MemoEntry["priority"]>("medium");
  const [newDueDate, setNewDueDate] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editTag, setEditTag] = useState<string>("");
  const [editPriority, setEditPriority] = useState<MemoEntry["priority"]>("medium");
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [newTagInput, setNewTagInput] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const newTagRef = useRef<HTMLDivElement>(null);

  // 新建时，根据当前筛选自动设置默认标签
  useEffect(() => {
    if (isAdding) {
      setNewTag(filterTag && filterTag !== "" ? filterTag : "");
    }
  }, [filterTag, isAdding]);

  // 点击外部取消新建标签
  useEffect(() => {
    if (!showNewTag) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (newTagRef.current && !newTagRef.current.contains(e.target as Node)) {
        setShowNewTag(false);
        setNewTagInput("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNewTag]);

  const handleAdd = () => {
    if (!newContent.trim()) return;
    dispatch({
      type: "ADD_MEMO",
      payload: {
        content: newContent.trim(),
        tag: newTag,
        priority: newPriority,
        dueDate: newDueDate || undefined,
      },
    });
    setNewContent("");
    setNewTag("");
    setNewDueDate("");
    setIsAdding(false);
  };

  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    dispatch({ type: "ADD_MEMO_TAG", payload: newTagInput.trim() });
    setNewTag(newTagInput.trim());
    setNewTagInput("");
    setShowNewTag(false);
  };

  const handleDeleteTag = (tagToDelete: string) => {
    // 不能删除"无标签"系统标签
    if (tagToDelete === "无标签") return;
    dispatch({ type: "DELETE_MEMO_TAG", payload: tagToDelete });
    // 如果删除的是当前筛选标签，重置筛选
    if (filterTag === tagToDelete) setFilterTag(null);
    // 如果删除的是当前选中标签，清空选择
    if (newTag === tagToDelete) {
      setNewTag("");
    }
  };

  const handleStartEdit = (memo: MemoEntry) => {
    setEditingId(memo.id);
    setEditContent(memo.content);
    setEditTag(memo.tag);
    setEditPriority(memo.priority);
    setEditDueDate(toDateTimeLocalValue(memo.dueDate));
  };

  const handleSaveEdit = () => {
    if (!editingId || !editContent.trim()) return;
    dispatch({ 
      type: "UPDATE_MEMO", 
      payload: { id: editingId, content: editContent.trim(), tag: editTag, priority: editPriority, dueDate: editDueDate || undefined } 
    });
    setEditingId(null);
    setEditContent("");
    setEditTag("");
    setEditPriority("medium");
    setEditDueDate("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
    setEditTag("");
    setEditPriority("medium");
    setEditDueDate("");
  };

  // 过滤并排序：优先级红>黄>蓝，同优先级按时间早的在前
  const filteredMemos = state.memos
    .filter((m) => {
      if (!state.showDoneMemos && m.done) return false;
      // filterTag === null: 全部, filterTag === "": 无标签, filterTag === "xxx": 特定标签
      if (filterTag !== null && m.tag !== filterTag) return false;
      if (searchQuery && !m.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      // 先按优先级排序
      const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      // 同优先级按时间排序（早的在前）
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const pendingCount = state.memos.filter((m) => !m.done).length;

  // 删除确认
  const { requestDelete, confirmDelete, cancelDelete, isConfirming } = useDeleteConfirm({
    onDelete: (id) => dispatch({ type: "DELETE_MEMO", payload: id }),
    confirmText: "确定删除这个待办？",
  });

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg h-full flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center">
            <Lightbulb size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">待办</h3>
            <p className="text-[10px] text-gray-500">{pendingCount} 条待处理</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => dispatch({ type: "SET_SHOW_DONE_MEMOS", payload: !state.showDoneMemos })} 
            className={`px-3 py-1 rounded-xl transition-colors whitespace-nowrap text-[11px] font-medium h-6 flex items-center ${state.showDoneMemos ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
          >
            {state.showDoneMemos ? "隐藏已完成" : "显示已完成"}
          </button>
          <button onClick={() => setIsAdding(true)} className="px-2 py-1 rounded-full text-[11px] bg-amber-100 text-amber-600 hover:bg-amber-200 leading-none h-6">+</button>
        </div>
      </div>

      {/* 搜索 */}
      <div className="relative mb-3 shrink-0">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索待办..."
          className="w-full bg-gray-100 rounded-xl pl-9 pr-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300" />
      </div>

      {/* 标签过滤 */}
      <div className="flex flex-wrap gap-1.5 mb-3 shrink-0 items-center">
        {/* 全部 - 用占位符保持高度一致 */}
        <div className="relative h-6">
          <button onClick={() => setFilterTag(null)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all leading-none h-full ${filterTag === null ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            全部
          </button>
        </div>
        {/* 无标签 - 用占位符保持高度一致 */}
        <div className="relative h-6">
          <button onClick={() => setFilterTag("")} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all leading-none h-full ${filterTag === "" ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            无标签
          </button>
        </div>
        {state.memoTags.filter(t => t !== "无标签").map((tag) => (
          <div key={tag} className="relative group h-6">
            <button onClick={() => setFilterTag(filterTag === tag ? null : tag)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all leading-none h-6 ${filterTag === tag ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {tag}
            </button>
            {/* 删除标签按钮 */}
            <button onClick={() => handleDeleteTag(tag)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 text-white rounded-full text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              ×
            </button>
          </div>
        ))}
        {/* 添加新标签 */}
        {showNewTag ? (
          <div ref={newTagRef} className="flex gap-1 items-center h-6">
            <input 
              type="text" 
              value={newTagInput} 
              onChange={(e) => setNewTagInput(e.target.value)} 
              onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(); if (e.key === "Escape") { setShowNewTag(false); setNewTagInput(""); } }} 
              placeholder="新标签" 
              autoFocus 
              className="w-16 px-2 py-1 rounded-full text-[11px] bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-300 leading-none h-full" 
            />
            <button onClick={handleAddTag} className="px-2 py-1 rounded-full text-[11px] bg-amber-500 text-white leading-none h-full">✓</button>
          </div>
        ) : (
          <div className="relative h-6">
            <button onClick={() => setShowNewTag(true)} className="px-2 py-1 rounded-full text-[11px] bg-gray-100 text-gray-500 hover:bg-gray-200 leading-none h-full">+</button>
            {/* 占位符，保持与带删除按钮的标签高度一致 */}
            <div className="absolute -top-1 -right-1 w-4 h-4 opacity-0 pointer-events-none" />
          </div>
        )}
      </div>

      {/* 添加表单 */}
      {isAdding && (
        <div className="mb-3 bg-white rounded-xl p-3 shrink-0 border border-gray-200">
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="添加待办..." rows={2} autoFocus className="w-full bg-gray-50 rounded-lg px-2 py-1.5 text-sm resize-none border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-300 mb-2" />
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <select value={newTag} onChange={(e) => setNewTag(e.target.value)} className="bg-white rounded-lg px-2 py-1.5 text-xs border border-gray-200 min-w-[90px] flex-1">
              <option value="">无标签</option>
              {state.memoTags.filter(t => t !== "无标签").map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="datetime-local"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="bg-white rounded-lg px-2 py-1.5 text-xs border border-gray-200 min-w-[180px] flex-1"
              title="设置截止时间"
            />
            <div className="flex items-center gap-2 w-full justify-between">
              <div className="flex gap-1">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button key={p} onClick={() => setNewPriority(p)} className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-all border ${newPriority === p ? `${PRIORITY_CONFIG[p].bg} ${PRIORITY_CONFIG[p].color} ${PRIORITY_CONFIG[p].border}` : "bg-white text-gray-400 border-gray-200"}`}>
                    {PRIORITY_CONFIG[p].icon}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-200">取消</button>
                <button onClick={handleAdd} disabled={!newContent.trim()} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium disabled:opacity-40 whitespace-nowrap">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 待办列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {filteredMemos.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Lightbulb size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{searchQuery ? "没有找到" : "记录你的待办"}</p>
          </div>
        ) : (
          filteredMemos.map((memo) => (
            <div key={memo.id} className={`group relative bg-gray-50 rounded-xl p-3 transition-colors border-l-4 ${memo.done ? "opacity-50" : ""} ${memo.priority === "high" ? "border-l-red-400" : memo.priority === "medium" ? "border-l-amber-400" : "border-l-blue-400"}`}>
              <div className="flex items-start gap-2">
                <button onClick={() => dispatch({ type: "UPDATE_MEMO", payload: { id: memo.id, done: !memo.done } })} className="shrink-0 mt-0.5">
                  {memo.done ? (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"><Check size={12} className="text-white" /></div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-amber-400 transition-colors" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  {editingId === memo.id ? (
                    <div className="bg-white rounded-xl p-3 border border-gray-200">
                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} autoFocus className="w-full bg-gray-50 rounded-lg px-2 py-1.5 text-sm resize-none border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-300 mb-2" />
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <select value={editTag} onChange={(e) => setEditTag(e.target.value)} className="bg-white rounded-lg px-2 py-1.5 text-xs border border-gray-200 min-w-[90px] flex-1">
                          <option value="">无标签</option>
                          {state.memoTags.filter(t => t !== "无标签").map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <input
                          type="datetime-local"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="bg-white rounded-lg px-2 py-1.5 text-xs border border-gray-200 min-w-[180px] flex-1"
                          title="设置截止时间"
                        />
                        <div className="flex items-center gap-2 w-full justify-between">
                          <div className="flex gap-1">
                            {(["low", "medium", "high"] as const).map((p) => (
                              <button key={p} onClick={() => setEditPriority(p)} className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition-all border ${editPriority === p ? `${PRIORITY_CONFIG[p].bg} ${PRIORITY_CONFIG[p].color} ${PRIORITY_CONFIG[p].border}` : "bg-white text-gray-400 border-gray-200"}`}>
                                {PRIORITY_CONFIG[p].icon}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <button onClick={handleCancelEdit} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-200">取消</button>
                            <button onClick={handleSaveEdit} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium whitespace-nowrap">保存</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className={`text-sm leading-relaxed ${memo.done ? "line-through text-gray-400" : "text-gray-700"}`}>{memo.content}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {memo.tag && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${PRIORITY_CONFIG[memo.priority].bg} ${PRIORITY_CONFIG[memo.priority].color}`}>
                            {PRIORITY_CONFIG[memo.priority].icon} {memo.tag}
                          </span>
                        )}
                        {memo.dueDate && (
                          <span className={`text-[10px] ${!memo.done && new Date(memo.dueDate).getTime() < Date.now() ? "text-red-500" : "text-amber-600"}`}>
                            截止 {formatDateTime(memo.dueDate)}
                          </span>
                        )}
                        <span className="text-[10px] text-gray-400">创建于 {formatDateTime(memo.createdAt)}</span>
                      </div>
                    </>
                  )}
                </div>
                {editingId !== memo.id && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button onClick={() => handleStartEdit(memo)} className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50"><Edit2 size={14} /></button>
                    {isConfirming(memo.id) ? (
                      <div className="flex items-center gap-0.5">
                        <span className="text-[10px] text-gray-500">确定？</span>
                        <button onClick={confirmDelete} className="p-1 rounded text-red-500 hover:bg-red-50"><Trash2 size={12} /></button>
                        <button onClick={cancelDelete} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={12} /></button>
                      </div>
                    ) : (
                      <button onClick={() => requestDelete(memo.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
