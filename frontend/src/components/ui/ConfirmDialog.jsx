import { useState } from 'react'

import { Button } from './Button'
import { Dialog, DialogContent } from './Dialog'

/** Imperative-friendly confirm dialog: <ConfirmDialog open .../> controlled from a parent. */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirm', danger = false, onConfirm, loading = false }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} className="max-w-sm">
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm} disabled={loading}>
            {loading ? 'Please wait…' : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useConfirmDialog() {
  const [state, setState] = useState({ open: false })

  const confirm = (options) => setState({ open: true, ...options })
  const close = () => setState((s) => ({ ...s, open: false }))

  const Rendered = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => (open ? null : close())}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      loading={state.loading}
      onConfirm={async () => {
        await state.onConfirm?.()
        close()
      }}
    />
  )

  return { confirm, close, ConfirmDialogElement: Rendered }
}
