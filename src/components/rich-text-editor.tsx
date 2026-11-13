'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Unlink,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  Save,
  Trash2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  SlidersHorizontal,
} from 'lucide-react'
import { Json } from '@/types/database'
import dynamic from 'next/dynamic'

const AiConsentModal = dynamic(
  () => import('@/components/ai/ai-consent-modal').then((mod) => mod.AiConsentModal),
  { ssr: false }
)

const NotesAssistantDialog = dynamic(
  () => import('@/components/ai/notes-assistant-dialog').then((mod) => mod.NotesAssistantDialog),
  { ssr: false }
)

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface RichTextEditorProps {
  initialContent?: Json
  onSave: (content: Json, plainText: string) => Promise<boolean>
  lastSavedAt?: string | null
  placeholder?: string
  onDelete?: () => Promise<boolean>
  className?: string
}

export function RichTextEditor({
  initialContent,
  onSave,
  lastSavedAt: initialLastSavedAt,
  placeholder = 'Write your lecture notes, facts, and concepts here...',
  onDelete,
  className = '',
}: RichTextEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [lastSaved, setLastSaved] = useState<string | null>(initialLastSavedAt || null)
  const [isDeleting, setIsDeleting] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const latestContentRef = useRef<{ content: Json; plainText: string } | null>(null)
  const isSavingRef = useRef<boolean>(false)

  // AI Assistant States
  const [isConsentOpen, setIsConsentOpen] = useState(false)
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false)
  const [selectedText, setSelectedText] = useState<string | null>(null)
  const [fullDocText, setFullDocText] = useState<string>('')

  // Mobile Toolbar & Scroll Cue States
  const toolbarScrollRef = useRef<HTMLDivElement>(null)
  const [showLeftFade, setShowLeftFade] = useState(false)
  const [showRightFade, setShowRightFade] = useState(false)
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false)

  const checkScrollFade = useCallback(() => {
    const el = toolbarScrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setShowLeftFade(scrollLeft > 6)
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - 6)
  }, [])

  const scrollToolbar = (direction: 'left' | 'right') => {
    const el = toolbarScrollRef.current
    if (!el) return
    const offset = direction === 'left' ? -150 : 150
    el.scrollBy({ left: offset, behavior: 'smooth' })
  }

  // Execute Save
  const performSave = useCallback(
    async (content: Json, plainText: string) => {
      if (isSavingRef.current) return
      isSavingRef.current = true
      setSaveStatus('saving')

      try {
        const success = await onSave(content, plainText)
        if (success) {
          setSaveStatus('saved')
          setLastSaved(new Date().toISOString())
        } else {
          setSaveStatus('error')
        }
      } catch (err) {
        console.error('Error during autosave:', err)
        setSaveStatus('error')
      } finally {
        isSavingRef.current = false
      }
    },
    [onSave]
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-400 underline underline-offset-2',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: (initialContent as any) || '',
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON() as Json
      const text = editor.getText()

      latestContentRef.current = { content: json, plainText: text }
      setSaveStatus('unsaved')

      // Clear pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // 1500ms debounce
      debounceTimerRef.current = setTimeout(() => {
        performSave(json, text)
      }, 1500)
    },
  })

  // Prevent loss of unsaved changes when navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'unsaved' || saveStatus === 'saving') {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [saveStatus])

  // Explicit Save Now trigger
  const handleSaveNow = () => {
    if (editor) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      performSave(editor.getJSON() as Json, editor.getText())
    }
  }

  // Format relative or time string
  const formatSavedTime = (isoString?: string | null) => {
    if (!isoString) return ''
    try {
      const date = new Date(isoString)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  // Set link helper
  const setLink = () => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter link URL:', previousUrl)

    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  // AI Assistant trigger helpers
  const openAiDialog = () => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from !== to) {
      const selected = editor.state.doc.textBetween(from, to, ' ')
      setSelectedText(selected)
    } else {
      setSelectedText(null)
    }
    setFullDocText(editor.getText())
    setIsAiAssistantOpen(true)
  }

  const handleTriggerAiAssistant = () => {
    if (!editor) return
    const hasConsented =
      typeof window !== 'undefined' &&
      (localStorage.getItem('study_companion_ai_consent') === 'true' ||
        localStorage.getItem('mts_ai_consent') === 'true')
    if (!hasConsented) {
      setIsConsentOpen(true)
      return
    }
    openAiDialog()
  }

  const handleConsentGranted = () => {
    setIsConsentOpen(false)
    openAiDialog()
  }

  const handleApplyAiChanges = (htmlContent: string, isSelection: boolean) => {
    if (!editor) return

    if (isSelection && editor.state.selection.from !== editor.state.selection.to) {
      editor.chain().focus().insertContent(htmlContent).run()
    } else {
      editor.chain().focus().setContent(htmlContent).run()
    }

    // Persist changes immediately
    const updatedJson = editor.getJSON() as Json
    const updatedText = editor.getText()
    performSave(updatedJson, updatedText)
  }

  useEffect(() => {
    const el = toolbarScrollRef.current
    if (!el) return
    checkScrollFade()
    el.addEventListener('scroll', checkScrollFade, { passive: true })
    window.addEventListener('resize', checkScrollFade, { passive: true })
    return () => {
      el.removeEventListener('scroll', checkScrollFade)
      window.removeEventListener('resize', checkScrollFade)
    }
  }, [checkScrollFade, editor])

  const getToolBtnClass = (isActive: boolean) =>
    `p-1.5 sm:p-1.5 rounded-lg sm:rounded text-xs font-semibold shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center transition-colors ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:bg-zinc-700'
    }`

  const getToolActionBtnClass = (disabled = false) =>
    `p-1.5 sm:p-1.5 rounded-lg sm:rounded text-xs font-semibold shrink-0 min-w-[36px] min-h-[36px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center transition-colors text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:bg-zinc-700 ${
      disabled ? 'opacity-30 pointer-events-none' : ''
    }`

  if (!editor) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Loading note editor...</span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border border-white/10 bg-[#0B0D12]/75 backdrop-blur-md flex flex-col overflow-hidden shadow-xl ${className}`}
    >
      {/* Editor Header & Toolbar */}
      <div className="border-b border-white/10 bg-[#0E1118]/80 backdrop-blur-sm p-2 sm:p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Compact Toolbar Strip with left/right fade cues and chevrons */}
        <div className={`relative flex items-center min-w-0 flex-1 ${isToolbarExpanded ? 'hidden sm:flex' : 'flex'}`}>
          {/* Left Fade & Scroll Indicator */}
          {showLeftFade && (
            <button
              type="button"
              onClick={() => scrollToolbar('left')}
              className="absolute left-0 top-0 bottom-0 z-10 w-7 bg-gradient-to-r from-[#0E1118] via-[#0E1118]/90 to-transparent flex items-center justify-start text-zinc-300 hover:text-white px-0.5 sm:hidden transition-opacity"
              aria-label="Scroll formatting tools left"
            >
              <ChevronLeft className="w-4 h-4 drop-shadow" />
            </button>
          )}

          {/* Scrollable Buttons Container */}
          <div
            ref={toolbarScrollRef}
            onScroll={checkScrollFade}
            className="flex items-center overflow-x-auto no-scrollbar gap-1 py-0.5 w-full sm:w-auto shrink min-w-0 scroll-smooth px-1"
          >
            {/* Headings */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={getToolBtnClass(editor.isActive('heading', { level: 1 }))}
              title="Heading 1"
              aria-label="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={getToolBtnClass(editor.isActive('heading', { level: 2 }))}
              title="Heading 2"
              aria-label="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={getToolBtnClass(editor.isActive('heading', { level: 3 }))}
              title="Heading 3"
              aria-label="Heading 3"
            >
              <Heading3 className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-5 bg-zinc-800 mx-1 shrink-0" />

            {/* Inline styles */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={getToolBtnClass(editor.isActive('bold'))}
              title="Bold (Ctrl+B)"
              aria-label="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={getToolBtnClass(editor.isActive('italic'))}
              title="Italic (Ctrl+I)"
              aria-label="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={getToolBtnClass(editor.isActive('underline'))}
              title="Underline (Ctrl+U)"
              aria-label="Underline"
            >
              <UnderlineIcon className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-5 bg-zinc-800 mx-1 shrink-0" />

            {/* Lists */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={getToolBtnClass(editor.isActive('bulletList'))}
              title="Bullet List"
              aria-label="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={getToolBtnClass(editor.isActive('orderedList'))}
              title="Numbered List"
              aria-label="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={getToolBtnClass(editor.isActive('taskList'))}
              title="Checklist / Tasks"
              aria-label="Checklist / Tasks"
            >
              <ListTodo className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={getToolBtnClass(editor.isActive('blockquote'))}
              title="Quote"
              aria-label="Quote"
            >
              <Quote className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-5 bg-zinc-800 mx-1 shrink-0" />

            {/* Links */}
            <button
              type="button"
              onClick={setLink}
              className={getToolBtnClass(editor.isActive('link'))}
              title="Insert Link"
              aria-label="Insert Link"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            {editor.isActive('link') && (
              <button
                type="button"
                onClick={() => editor.chain().focus().unsetLink().run()}
                className={getToolActionBtnClass()}
                title="Remove Link"
                aria-label="Remove Link"
              >
                <Unlink className="w-4 h-4" />
              </button>
            )}

            <div className="w-[1px] h-5 bg-zinc-800 mx-1 shrink-0" />

            {/* Undo / Redo */}
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className={getToolActionBtnClass(!editor.can().undo())}
              title="Undo"
              aria-label="Undo"
            >
              <Undo className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className={getToolActionBtnClass(!editor.can().redo())}
              title="Redo"
              aria-label="Redo"
            >
              <Redo className="w-4 h-4" />
            </button>

            <div className="w-[1px] h-5 bg-zinc-800 mx-1 shrink-0" />

            {/* AI Notes Assistant Button */}
            <button
              type="button"
              onClick={handleTriggerAiAssistant}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg sm:rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border border-purple-500/30 text-xs font-medium transition-all shadow-sm shrink-0 min-h-[36px] sm:min-h-[32px]"
              title="AI Notes Assistant (Organise, Grammar, Summarise, etc.)"
              aria-label="AI Notes Assistant"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>AI Assistant</span>
            </button>
          </div>

          {/* Right Fade & Scroll Indicator */}
          {showRightFade && (
            <button
              type="button"
              onClick={() => scrollToolbar('right')}
              className="absolute right-0 top-0 bottom-0 z-10 w-7 bg-gradient-to-l from-[#0E1118] via-[#0E1118]/90 to-transparent flex items-center justify-end text-zinc-300 hover:text-white px-0.5 sm:hidden transition-opacity"
              aria-label="Scroll formatting tools right"
            >
              <ChevronRight className="w-4 h-4 drop-shadow" />
            </button>
          )}
        </div>

        {/* Mobile Expanded Tool Palette */}
        {isToolbarExpanded && (
          <div className="sm:hidden w-full p-2.5 bg-[#0a0c12]/95 border border-white/10 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 px-0.5">
                Text Styling
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={getToolBtnClass(editor.isActive('heading', { level: 1 }))}
                  title="Heading 1"
                  aria-label="Heading 1"
                >
                  <Heading1 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={getToolBtnClass(editor.isActive('heading', { level: 2 }))}
                  title="Heading 2"
                  aria-label="Heading 2"
                >
                  <Heading2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={getToolBtnClass(editor.isActive('heading', { level: 3 }))}
                  title="Heading 3"
                  aria-label="Heading 3"
                >
                  <Heading3 className="w-4 h-4" />
                </button>
                <div className="w-[1px] h-5 bg-zinc-800 mx-1" />
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={getToolBtnClass(editor.isActive('bold'))}
                  title="Bold (Ctrl+B)"
                  aria-label="Bold"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={getToolBtnClass(editor.isActive('italic'))}
                  title="Italic (Ctrl+I)"
                  aria-label="Italic"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className={getToolBtnClass(editor.isActive('underline'))}
                  title="Underline (Ctrl+U)"
                  aria-label="Underline"
                >
                  <UnderlineIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 px-0.5">
                Lists & Quotes
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={getToolBtnClass(editor.isActive('bulletList'))}
                  title="Bullet List"
                  aria-label="Bullet List"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={getToolBtnClass(editor.isActive('orderedList'))}
                  title="Numbered List"
                  aria-label="Numbered List"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                  className={getToolBtnClass(editor.isActive('taskList'))}
                  title="Checklist / Tasks"
                  aria-label="Checklist / Tasks"
                >
                  <ListTodo className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  className={getToolBtnClass(editor.isActive('blockquote'))}
                  title="Quote"
                  aria-label="Quote"
                >
                  <Quote className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1 px-0.5">
                Links & History
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={setLink}
                  className={getToolBtnClass(editor.isActive('link'))}
                  title="Insert Link"
                  aria-label="Insert Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>
                {editor.isActive('link') && (
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().unsetLink().run()}
                    className={getToolActionBtnClass()}
                    title="Remove Link"
                    aria-label="Remove Link"
                  >
                    <Unlink className="w-4 h-4" />
                  </button>
                )}
                <div className="w-[1px] h-5 bg-zinc-800 mx-1" />
                <button
                  type="button"
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                  className={getToolActionBtnClass(!editor.can().undo())}
                  title="Undo"
                  aria-label="Undo"
                >
                  <Undo className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                  className={getToolActionBtnClass(!editor.can().redo())}
                  title="Redo"
                  aria-label="Redo"
                >
                  <Redo className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-purple-400 mb-1 px-0.5">
                AI Intelligence
              </div>
              <button
                type="button"
                onClick={handleTriggerAiAssistant}
                className="w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 text-xs font-semibold shadow-sm transition-all min-h-[38px]"
                title="AI Notes Assistant (Organise, Grammar, Summarise, etc.)"
                aria-label="AI Notes Assistant"
              >
                <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Open AI Notes Assistant</span>
              </button>
            </div>
          </div>
        )}

        {/* Status Indicator & Save Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-2 text-xs w-full sm:w-auto pt-1.5 sm:pt-0 border-t border-zinc-800/40 sm:border-0 shrink-0">
          <div className="flex items-center min-w-0">
            {saveStatus === 'saving' && (
              <span className="flex items-center text-amber-400 truncate">
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin shrink-0" />
                <span className="truncate">Saving...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center text-emerald-400 truncate">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="truncate">Saved {lastSaved && `(${formatSavedTime(lastSaved)})`}</span>
              </span>
            )}
            {saveStatus === 'unsaved' && (
              <span className="flex items-center text-zinc-400 truncate">
                <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5 animate-ping shrink-0" />
                <span className="truncate">Unsaved</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center text-red-400 truncate">
                <AlertCircle className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                <span className="truncate">Save failed</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Mobile All Tools Toggle Button */}
            <button
              type="button"
              onClick={() => setIsToolbarExpanded((prev) => !prev)}
              className="sm:hidden flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors min-h-[36px]"
              aria-expanded={isToolbarExpanded}
              aria-label={isToolbarExpanded ? 'Collapse toolbar' : 'Expand all formatting tools'}
            >
              {isToolbarExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-blue-400" />
                  <span>Compact</span>
                </>
              ) : (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                  <span>All Tools</span>
                </>
              )}
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveNow}
              disabled={saveStatus === 'saving' || isDeleting}
              className="h-9 sm:h-7 px-3 sm:px-2.5 text-xs text-zinc-200 font-medium min-h-[36px] sm:min-h-[32px]"
            >
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </>
              )}
            </Button>

            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (isDeleting) return
                  setIsDeleting(true)
                  try {
                    await onDelete()
                  } finally {
                    setIsDeleting(false)
                  }
                }}
                disabled={saveStatus === 'saving' || isDeleting}
                className="h-9 sm:h-7 px-2.5 text-xs text-zinc-400 hover:text-red-400 hover:border-red-500/30 min-h-[36px] sm:min-h-[32px]"
                title="Delete Note"
              >
                {isDeleting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Editor Writing Area */}
      <div className="p-4 sm:p-6 md:p-8 flex-1 cursor-text focus-within:ring-0">
        <div className="max-w-3xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* AI Modals */}
      {isConsentOpen && (
        <AiConsentModal
          isOpen={isConsentOpen}
          onClose={() => setIsConsentOpen(false)}
          onConsentGranted={handleConsentGranted}
        />
      )}

      {isAiAssistantOpen && (
        <NotesAssistantDialog
          isOpen={isAiAssistantOpen}
          onClose={() => setIsAiAssistantOpen(false)}
          selectedText={selectedText}
          fullText={fullDocText}
          onApplyChanges={handleApplyAiChanges}
        />
      )}
    </div>
  )
}
