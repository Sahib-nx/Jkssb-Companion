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
} from 'lucide-react'
import { Json } from '@/types/database'

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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const latestContentRef = useRef<{ content: Json; plainText: string } | null>(null)
  const isSavingRef = useRef<boolean>(false)

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
      className={`rounded-xl border border-zinc-800/80 bg-[#11141D] flex flex-col overflow-hidden shadow-sm ${className}`}
    >
      {/* Editor Header & Toolbar */}
      <div className="border-b border-zinc-800/80 bg-[#0E1118] p-2 sm:p-2.5 flex flex-wrap items-center justify-between gap-2">
        {/* Formatting Actions */}
        <div className="flex flex-wrap items-center gap-1">
          {/* Headings */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded text-xs font-semibold ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded text-xs font-semibold ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded text-xs font-semibold ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

          {/* Inline styles */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded ${
              editor.isActive('bold')
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded ${
              editor.isActive('italic')
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`p-1.5 rounded ${
              editor.isActive('underline')
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded ${
              editor.isActive('bulletList')
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded ${
              editor.isActive('orderedList')
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded ${
              editor.isActive('taskList')
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Checklist / Tasks"
          >
            <ListTodo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded ${
              editor.isActive('blockquote')
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

          {/* Links */}
          <button
            type="button"
            onClick={setLink}
            className={`p-1.5 rounded ${
              editor.isActive('link')
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Insert Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          {editor.isActive('link') && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetLink().run()}
              className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
              title="Remove Link"
            >
              <Unlink className="w-4 h-4" />
            </button>
          )}

          <div className="w-[1px] h-4 bg-zinc-800 mx-1" />

          {/* Undo / Redo */}
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
            title="Undo"
          >
            <Undo className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none"
            title="Redo"
          >
            <Redo className="w-4 h-4" />
          </button>
        </div>

        {/* Status Indicator & Save Actions */}
        <div className="flex items-center space-x-3 text-xs">
          {saveStatus === 'saving' && (
            <span className="flex items-center text-amber-400">
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Saved {lastSaved && `at ${formatSavedTime(lastSaved)}`}
            </span>
          )}
          {saveStatus === 'unsaved' && (
            <span className="flex items-center text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5 animate-ping" />
              Unsaved changes
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center text-red-400">
              <AlertCircle className="w-3.5 h-3.5 mr-1.5" />
              Save error
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveNow}
            disabled={saveStatus === 'saving'}
            className="h-7 px-2.5 text-xs text-zinc-300"
          >
            <Save className="w-3 h-3 mr-1" />
            Save
          </Button>

          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="h-7 px-2 text-xs text-zinc-400 hover:text-red-400 hover:border-red-500/30"
              title="Delete Note"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor Writing Area */}
      <div className="p-6 md:p-8 flex-1 cursor-text focus-within:ring-0">
        <div className="max-w-3xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
