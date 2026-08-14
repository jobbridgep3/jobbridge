import { Label } from '../ui/Input'
import { cn } from '../../lib/utils'

/** Tag-style multi-select for the Top/Bottom/Footwear dress code shown in the SPES
 * orientation/exam schedule emails and batch detail page. Preset options match the
 * spec's own reference dress-code copy; value shape is {top:[], bottom:[], footwear:[]}. */

const PRESETS = {
  top: ['Polo Shirt', 'T-shirt', 'Long sleeves', 'Short sleeves'],
  bottom: ['Jeans', 'Slacks'],
  footwear: ['Formal Shoes', 'Slip-on Shoes', 'Running Shoes'],
}

const SECTION_LABELS = { top: 'Top', bottom: 'Bottom', footwear: 'Footwear' }

function TagToggle({ label, selected, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        selected
          ? 'border-primary-700 bg-primary-800 text-white'
          : 'border-border-hover bg-surface text-text-secondary hover:bg-surface-hover'
      )}
    >
      {label}
    </button>
  )
}

export function DressCodeEditor({ value, onChange, disabled }) {
  const dressCode = value || { top: [], bottom: [], footwear: [] }

  const toggle = (section, option) => {
    if (disabled) return
    const current = dressCode[section] || []
    const next = current.includes(option) ? current.filter((o) => o !== option) : [...current, option]
    onChange({ ...dressCode, [section]: next })
  }

  return (
    <div className="space-y-3">
      {Object.entries(PRESETS).map(([section, options]) => (
        <div key={section}>
          <Label>{SECTION_LABELS[section]}</Label>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <TagToggle
                key={option}
                label={option}
                selected={(dressCode[section] || []).includes(option)}
                onToggle={() => toggle(section, option)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
