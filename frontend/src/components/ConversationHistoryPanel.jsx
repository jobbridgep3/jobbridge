import { Pin, Plus, Star, Trash2 } from 'lucide-react'

import { cn } from '../lib/utils'

// Presentational only — ChatbotWidget owns all the data fetching/mutation calls and
// passes plain handlers down, so this stays a simple list to reason about.
export function ConversationHistoryPanel({
  conversations,
  favoritesOnly,
  onToggleFavoritesOnly,
  onSelect,
  onPin,
  onFavorite,
  onDelete,
  onNewChat,
}) {
  const visible = favoritesOnly ? conversations.filter((c) => c.is_favorite) : conversations

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle p-2">
        <button
          onClick={onNewChat}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-800 px-3 py-2 text-sm text-white hover:bg-primary-900"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
        <button
          onClick={onToggleFavoritesOnly}
          aria-pressed={favoritesOnly}
          aria-label="Show favorites only"
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            favoritesOnly ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300' : 'text-text-muted hover:bg-surface-hover'
          )}
        >
          <Star className="h-4 w-4" fill={favoritesOnly ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {visible.length === 0 && (
          <p className="p-3 text-center text-xs text-text-muted">
            {favoritesOnly ? 'No favorited conversations yet.' : 'No conversations yet — start chatting!'}
          </p>
        )}
        {visible.map((conv) => (
          <div key={conv.id} className="group flex items-center gap-1 rounded-lg px-1 py-2 hover:bg-surface-hover">
            <button onClick={() => onSelect(conv.id)} className="min-w-0 flex-1 truncate px-1 text-left text-sm text-text-primary">
              {conv.title}
            </button>
            <button
              onClick={() => onPin(conv)}
              aria-label={conv.is_pinned ? 'Unpin conversation' : 'Pin conversation'}
              className={cn(
                'shrink-0 rounded p-1',
                conv.is_pinned ? 'text-primary-600' : 'text-text-muted opacity-0 hover:text-text-primary group-hover:opacity-100'
              )}
            >
              <Pin className="h-3.5 w-3.5" fill={conv.is_pinned ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => onFavorite(conv)}
              aria-label={conv.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              className={cn(
                'shrink-0 rounded p-1',
                conv.is_favorite ? 'text-amber-500' : 'text-text-muted opacity-0 hover:text-text-primary group-hover:opacity-100'
              )}
            >
              <Star className="h-3.5 w-3.5" fill={conv.is_favorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => onDelete(conv)}
              aria-label="Delete conversation"
              className="shrink-0 rounded p-1 text-text-muted opacity-0 hover:text-red-500 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
