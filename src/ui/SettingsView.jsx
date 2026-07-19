import { useEffect, useState } from 'react'
import {
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  MAX_AUTOCLOSE_DELAY_SEC,
} from '../shared/constants.js'
import { DEFAULT_REVIEW_PROMPT, DEFAULT_SYNTHESIS_PROMPT } from '../background/prompts.js'
import { loadSettings, saveSettings, runOptionsFrom } from './settings.js'

// Settings tab: per-run execution options plus the Stage 2 (peer review) and
// Stage 3 (chairman synthesis) prompt templates. Everything is stored locally in
// the browser. Prompt overrides left at their default (or cleared) fall back to
// the Karpathy default at run time. Run options save immediately on change;
// prompt edits are held as drafts and persisted on an explicit Save.
export default function SettingsView() {
  const [loaded, setLoaded] = useState(false)
  // `draft` = current textarea contents; `saved` = last-persisted effective value.
  const [reviewDraft, setReviewDraft] = useState(DEFAULT_REVIEW_PROMPT)
  const [reviewSaved, setReviewSaved] = useState(DEFAULT_REVIEW_PROMPT)
  const [synthDraft, setSynthDraft] = useState(DEFAULT_SYNTHESIS_PROMPT)
  const [synthSaved, setSynthSaved] = useState(DEFAULT_SYNTHESIS_PROMPT)
  const [runOpts, setRunOpts] = useState(runOptionsFrom({}))

  useEffect(() => {
    loadSettings().then((s) => {
      const r = s.reviewPrompt ?? DEFAULT_REVIEW_PROMPT
      const y = s.synthesisPrompt ?? DEFAULT_SYNTHESIS_PROMPT
      setReviewDraft(r)
      setReviewSaved(r)
      setSynthDraft(y)
      setSynthSaved(y)
      setRunOpts(runOptionsFrom(s))
      setLoaded(true)
    })
  }, [])

  if (!loaded) return null

  // Persist everything together. Run options are always written; a prompt equal
  // to its default is dropped so the run keeps tracking upstream if the default
  // ever changes.
  async function persist(opts, review, synthesis) {
    const settings = { ...opts }
    if (review.trim() && review !== DEFAULT_REVIEW_PROMPT) settings.reviewPrompt = review
    if (synthesis.trim() && synthesis !== DEFAULT_SYNTHESIS_PROMPT) {
      settings.synthesisPrompt = synthesis
    }
    await saveSettings(settings)
  }

  const persistPair = (review, synthesis) => persist(runOpts, review, synthesis)

  function setOpt(key, value) {
    const next = { ...runOpts, [key]: value }
    setRunOpts(next)
    persist(next, reviewSaved, synthSaved)
  }

  return (
    <div className="space-y-4">
      <RunOptions opts={runOpts} setOpt={setOpt} />

      <p className="text-[11px] leading-snug text-council-muted">
        Override the council's prompt templates. These are stored in this browser
        only and default to Karpathy's{' '}
        <span className="font-medium text-council-text">llm-council</span> prompts.
        Use the <code className="rounded bg-council-panel2 px-1">{'{{tokens}}'}</code>{' '}
        below to inject the run's content — remove a token and that content won't
        be included. Changes take effect on the next council run.
      </p>

      <PromptEditor
        title="Stage 2 · Peer Review"
        accent="#e0b341"
        value={reviewDraft}
        onChange={setReviewDraft}
        dirty={reviewDraft !== reviewSaved}
        isDefault={reviewSaved === DEFAULT_REVIEW_PROMPT}
        tokens={['query', 'responses']}
        onSave={() => {
          setReviewSaved(reviewDraft)
          persistPair(reviewDraft, synthSaved)
        }}
        onReset={() => {
          setReviewDraft(DEFAULT_REVIEW_PROMPT)
          setReviewSaved(DEFAULT_REVIEW_PROMPT)
          persistPair(DEFAULT_REVIEW_PROMPT, synthSaved)
        }}
      />

      <PromptEditor
        title="Stage 3 · Chairman Synthesis"
        accent="#6ea8fe"
        value={synthDraft}
        onChange={setSynthDraft}
        dirty={synthDraft !== synthSaved}
        isDefault={synthSaved === DEFAULT_SYNTHESIS_PROMPT}
        tokens={['query', 'responses', 'reviews']}
        onSave={() => {
          setSynthSaved(synthDraft)
          persistPair(reviewSaved, synthDraft)
        }}
        onReset={() => {
          setSynthDraft(DEFAULT_SYNTHESIS_PROMPT)
          setSynthSaved(DEFAULT_SYNTHESIS_PROMPT)
          persistPair(reviewSaved, DEFAULT_SYNTHESIS_PROMPT)
        }}
      />
    </div>
  )
}

// Per-run execution options. Each control persists immediately and applies to
// the next council run.
function RunOptions({ opts, setOpt }) {
  return (
    <section className="rounded-xl border border-council-border bg-council-panel p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-council-muted">
          Run options
        </span>
        <span className="text-[10px] text-council-faint">Saved · applies to your next run</span>
      </div>

      <div className="w-28">
        <label
          className="mb-1 block text-xs font-semibold uppercase tracking-wide text-council-muted"
          title="How long a response may stall (make no progress) before giving up. Applies to every council member and the Chairman. A response that keeps streaming can run up to ~2× this."
        >
          Idle timeout (s)
        </label>
        <input
          type="number"
          min={MIN_TIMEOUT_MS / 1000}
          max={MAX_TIMEOUT_MS / 1000}
          value={opts.timeoutSec}
          onChange={(e) => setOpt('timeoutSec', Number(e.target.value) || 60)}
          title="How long a response may stall (make no progress) before giving up. Applies to every council member and the Chairman. A response that keeps streaming can run up to ~2× this."
          className="w-full rounded-lg border border-council-border bg-council-panel2 px-2 py-1.5 text-sm outline-none focus:border-council-accent"
        />
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-council-border bg-council-panel2 p-2.5 text-xs">
        <input
          type="checkbox"
          checked={opts.dedicatedWindow}
          onChange={(e) => setOpt('dedicatedWindow', e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-council-accent"
        />
        <span>
          <span className="font-medium text-council-text">
            Run in a separate window
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-council-muted">
            Opens the council tabs in their own window so your current tabs aren't
            rearranged. (The council window still briefly takes focus while typing
            each prompt.)
          </span>
        </span>
      </label>

      <div className="mt-2 rounded-lg border border-council-border bg-council-panel2 p-2.5 text-xs">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={opts.autoClose}
            onChange={(e) => setOpt('autoClose', e.target.checked)}
            className="h-4 w-4 shrink-0 accent-council-accent"
          />
          <span className="font-medium text-council-text">
            {opts.dedicatedWindow ? 'Close window when finished' : 'Close tabs when finished'}
          </span>
        </label>
        {opts.autoClose && (
          <div className="mt-2 flex items-center gap-2 pl-6 text-council-muted">
            <span>after</span>
            <input
              type="number"
              min={0}
              max={MAX_AUTOCLOSE_DELAY_SEC}
              value={opts.autoCloseSec}
              onChange={(e) =>
                setOpt(
                  'autoCloseSec',
                  Math.min(MAX_AUTOCLOSE_DELAY_SEC, Math.max(0, Number(e.target.value) || 0)),
                )
              }
              className="w-16 rounded border border-council-border bg-council-panel px-2 py-1 text-sm text-council-text outline-none focus:border-council-accent"
            />
            <span>seconds</span>
          </div>
        )}
      </div>

      <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-council-border bg-council-panel2 p-2.5 text-xs">
        <input
          type="checkbox"
          checked={opts.keepActive}
          onChange={(e) => setOpt('keepActive', e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-council-accent"
        />
        <span>
          <span className="font-medium text-council-text">
            Keep tabs active while generating
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-council-muted">
            Periodically brings each still-generating tab to the front so its
            output renders and is captured. Some sites pause rendering in
            background tabs, which can stall or drop a response. (Briefly steals
            focus every 15s while a response is pending.)
          </span>
        </span>
      </label>

      <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-lg border border-council-border bg-council-panel2 p-2.5 text-xs">
        <input
          type="checkbox"
          checked={opts.quickAnswer}
          onChange={(e) => setOpt('quickAnswer', e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-council-accent"
        />
        <span>
          <span className="font-medium text-council-text">
            Prefer quick answers
          </span>
          <span className="mt-0.5 block text-[11px] leading-snug text-council-muted">
            If a provider offers an “Answer now” / quick-answer control, click it
            to speed up First Opinions and Peer Review. The Chairman’s final
            synthesis always uses the full answer.
          </span>
        </span>
      </label>
    </section>
  )
}

function PromptEditor({ title, accent, value, onChange, dirty, isDefault, tokens, onSave, onReset }) {
  const [justSaved, setJustSaved] = useState(false)

  function handleSave() {
    onSave()
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 1500)
  }

  const status = dirty ? 'Unsaved changes' : justSaved ? '✓ Saved' : isDefault ? 'Default' : 'Customized'
  const statusColor = dirty
    ? 'text-amber-600 dark:text-amber-300'
    : justSaved
      ? 'text-council-accent'
      : isDefault
        ? 'text-council-faint'
        : 'text-council-text'

  return (
    <section className="rounded-xl border border-council-border bg-council-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: accent }}>
          {title}
        </span>
        <span className={`text-[10px] font-medium ${statusColor}`}>{status}</span>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        spellCheck={false}
        className="w-full resize-y rounded-lg border border-council-border bg-council-panel2 px-3 py-2 font-mono text-[11px] leading-relaxed outline-none focus:border-council-accent"
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-council-muted">
        <span>Tokens:</span>
        {tokens.map((t) => {
          const present = value.includes(`{{${t}}}`)
          return (
            <code
              key={t}
              title={present ? 'Present' : 'Missing — this content will be omitted'}
              className={`rounded px-1 py-0.5 ${
                present
                  ? 'bg-council-panel2 text-council-text'
                  : 'bg-red-500/10 text-red-600 dark:text-red-300'
              }`}
            >
              {`{{${t}}}`}
            </code>
          )
        })}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty}
          className="rounded-lg bg-council-accent px-3 py-1.5 text-xs font-semibold text-council-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={isDefault && !dirty}
          className="rounded-lg border border-council-border px-3 py-1.5 text-xs font-medium text-council-text transition hover:border-council-accent hover:text-council-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↺ Reset to default
        </button>
      </div>
    </section>
  )
}
