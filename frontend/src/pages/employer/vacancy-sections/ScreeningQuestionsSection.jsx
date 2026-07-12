import { Plus, Trash2 } from 'lucide-react'

import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input, Label, Select } from '../../../components/ui/Input'

const QUESTION_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'yes_no', label: 'Yes/No' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
]

export function ScreeningQuestionsSection({ form, setForm }) {
  const questions = form.screening_questions || []

  const updateQuestions = (next) => setForm((f) => ({ ...f, screening_questions: next }))

  const addQuestion = () => {
    updateQuestions([
      ...questions,
      { question_text: '', question_type: 'text', options: [], is_required: true, display_order: questions.length },
    ])
  }

  const updateQuestion = (index, patch) => {
    updateQuestions(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  const removeQuestion = (index) => {
    updateQuestions(questions.filter((_, i) => i !== index))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Screening Questions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.map((q, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div>
                <Label>Question</Label>
                <Input value={q.question_text} onChange={(e) => updateQuestion(i, { question_text: e.target.value })} />
              </div>
              <div className="flex items-end">
                <button type="button" onClick={() => removeQuestion(i)} className="text-red-500 hover:text-red-600" aria-label="Remove question">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Answer Type</Label>
                <Select value={q.question_type} onChange={(e) => updateQuestion(i, { question_type: e.target.value })}>
                  {QUESTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox" checked={q.is_required} onChange={(e) => updateQuestion(i, { is_required: e.target.checked })}
                    className="rounded border-slate-300 text-primary-600"
                  />
                  Required
                </label>
              </div>
            </div>
            {q.question_type === 'multiple_choice' && (
              <div className="mt-3">
                <Label>Options (comma-separated)</Label>
                <Input
                  value={(q.options || []).join(', ')}
                  onChange={(e) => updateQuestion(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Option A, Option B, Option C"
                />
              </div>
            )}
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={addQuestion}>
          <Plus className="h-4 w-4" /> Add Screening Question
        </Button>
      </CardContent>
    </Card>
  )
}
