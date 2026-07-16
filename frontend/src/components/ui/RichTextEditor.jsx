import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Bold, Italic, List, ListOrdered, Strikethrough } from 'lucide-react'
import { useEffect } from 'react'

import { cn } from '../../lib/utils'

function ToolbarButton({ active, onClick, children, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'rounded p-1.5 text-text-muted hover:bg-surface-hover',
        active && 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-200'
      )}
    >
      {children}
    </button>
  )
}

/** Rich-text editor for vacancy description fields (summary/responsibilities/
 * daily_tasks). Emits sanitized-on-the-backend HTML — the server re-sanitizes
 * with bleach regardless (utils/html_sanitizer.py), so this only needs to offer
 * a constrained, safe toolbar, not enforce security client-side. */
export function RichTextEditor({ value, onChange, placeholder, className }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [3, 4] } })],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none min-h-[120px] px-3 py-2 focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML() && document.activeElement?.closest('.ProseMirror') === null) {
      editor.commands.setContent(value || '', { emitUpdate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  if (!editor) return null

  return (
    <div className={cn('rounded-lg border border-border-hover bg-surface', className)}>
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  )
}
