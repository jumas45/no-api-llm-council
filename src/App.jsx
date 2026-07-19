import { useEffect, useState } from 'react'
import {
  COUNCIL_MEMBERS,
  MEMBER_IDS,
  DEFAULT_CHAIRMAN,
  STATUS,
} from './shared/constants.js'
import {
  startCouncil,
  cancelCouncil,
  resetCouncil,
  getState,
  onCouncilUpdate,
} from './ui/bus.js'
import RunView from './ui/RunView.jsx'
import HistoryView from './ui/HistoryView.jsx'
import SettingsView from './ui/SettingsView.jsx'
import StatusBadge from './ui/StatusBadge.jsx'
import PulseDot from './ui/PulseDot.jsx'
import { loadSettings, runOptionsFrom } from './ui/settings.js'
import { initialTheme, applyTheme } from './ui/theme.js'

export default function App() {
  const [tab, setTab] = useState('council') // 'council' | 'history' | 'settings'
  const [theme, setTheme] = useState(initialTheme)
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState(MEMBER_IDS)
  const [chairman, setChairman] = useState(DEFAULT_CHAIRMAN)
  const [state, setState] = useState(null)

  useEffect(() => {
    getState().then((s) => s && setState(s))
    return onCouncilUpdate(setState)
  }, [])

  const running = state?.status === STATUS.RUNNING

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }

  useEffect(() => {
    if (!members.includes(chairman) && members.length) setChairman(members[0])
  }, [members]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleMember(id) {
    setMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    )
  }

  async function handleStart() {
    if (!query.trim() || members.length === 0) return
    // Pull the latest run options + prompt overrides (Settings tab) at launch.
    const settings = await loadSettings()
    const opts = runOptionsFrom(settings)
    startCouncil({
      query: query.trim(),
      members,
      chairman: members.includes(chairman) ? chairman : members[0],
      timeoutMs: Math.round(opts.timeoutSec * 1000),
      dedicatedWindow: opts.dedicatedWindow,
      autoClose: opts.autoClose,
      autoCloseDelayMs: Math.round(opts.autoCloseSec * 1000),
      keepActive: opts.keepActive,
      quickAnswer: opts.quickAnswer,
      reviewPrompt: settings.reviewPrompt || null,
      synthesisPrompt: settings.synthesisPrompt || null,
    })
  }

  function handleReset() {
    resetCouncil()
    setState(null)
    setQuery('')
  }

  function reuseFromHistory(run) {
    setQuery(run.query)
    if (run.members?.length) setMembers(run.members)
    if (run.chairman) setChairman(run.chairman)
    setTab('council')
  }

  const canStart = query.trim().length > 0 && members.length > 0 && !running

  return (
    <div className="flex h-full flex-col bg-council-bg text-council-text">
      <Header
        running={running}
        state={state}
        tab={tab}
        setTab={setTab}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tab === 'history' ? (
          <HistoryView onReload={reuseFromHistory} />
        ) : tab === 'settings' ? (
          <SettingsView />
        ) : (
          <>
            <Controls
              query={query}
              setQuery={setQuery}
              members={members}
              toggleMember={toggleMember}
              chairman={chairman}
              setChairman={setChairman}
              running={running}
              canStart={canStart}
              onStart={handleStart}
              onCancel={() => cancelCouncil()}
              onReset={handleReset}
              showReset={Boolean(state && state.status !== STATUS.IDLE)}
            />

            {state && state.status !== STATUS.IDLE ? (
              <div className="mt-4">
                <RunView run={state} live />
              </div>
            ) : (
              <p className="mt-8 text-center text-xs text-council-faint">
                Make sure you're logged into ChatGPT, Claude, and Gemini in this
                browser, then convene the council.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Header({ running, state, tab, setTab, theme, onToggleTheme }) {
  return (
    <header className="border-b border-council-border bg-council-panel">
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏛️</span>
          <h1 className="text-sm font-bold tracking-wide">LLM Council</h1>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <div className="flex items-center gap-2">
              <PulseDot size={9} />
              <span className="text-[11px] text-council-accent">
                In session · Stage {state?.stage || 1}
              </span>
            </div>
          ) : (
            state?.status &&
            state.status !== STATUS.IDLE && <StatusBadge status={state.status} />
          )}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
      <nav className="flex gap-1 px-3">
        {[
          ['council', 'Council'],
          ['history', 'History'],
          ['settings', 'Settings'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold transition ${
              tab === id
                ? 'border-council-accent text-council-strong'
                : 'border-transparent text-council-muted hover:text-council-text'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  )
}

// Sun/moon button toggling light and dark mode.
function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-council-border text-council-muted transition hover:border-council-accent hover:text-council-strong"
    >
      {dark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  )
}

function Controls({
  query,
  setQuery,
  members,
  toggleMember,
  chairman,
  setChairman,
  running,
  canStart,
  onStart,
  onCancel,
  onReset,
  showReset,
}) {
  return (
    <section className="rounded-xl border border-council-border bg-council-panel p-3">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-council-muted">
        Query
      </label>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Ask the council anything…"
        rows={3}
        disabled={running}
        className="w-full resize-y rounded-lg border border-council-border bg-council-panel2 px-3 py-2 text-sm outline-none placeholder:text-council-faint focus:border-council-accent disabled:opacity-60"
      />

      <div className="mt-3">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-council-muted">
          Council members
        </span>
        <div className="flex flex-wrap gap-2">
          {MEMBER_IDS.map((id) => {
            const m = COUNCIL_MEMBERS[id]
            const on = members.includes(id)
            return (
              <button
                key={id}
                type="button"
                disabled={running}
                onClick={() => toggleMember(id)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-60 ${
                  on
                    ? 'border-transparent text-white'
                    : 'border-council-border bg-council-panel2 text-council-muted'
                }`}
                style={on ? { background: m.color } : undefined}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: on ? '#fff' : m.color }}
                />
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-council-muted">
          Chairman
        </label>
        <select
          value={chairman}
          disabled={running}
          onChange={(e) => setChairman(e.target.value)}
          className="w-full rounded-lg border border-council-border bg-council-panel2 px-2 py-1.5 text-sm outline-none focus:border-council-accent disabled:opacity-60"
        >
          {members.map((id) => (
            <option key={id} value={id}>
              {COUNCIL_MEMBERS[id].label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="flex-1 rounded-lg bg-council-accent px-4 py-2 text-sm font-semibold text-council-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? 'Council in session…' : 'Convene Council'}
        </button>
        {running && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-amber-500/50 px-4 py-2 text-sm font-semibold text-amber-600 transition hover:bg-amber-500/10 dark:text-amber-300"
            title="Stop generating but keep the responses gathered so far"
          >
            Cancel
          </button>
        )}
      </div>

      {showReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-2 w-full rounded-lg border border-council-border px-4 py-2 text-sm font-medium text-council-text transition hover:border-red-500/50 hover:text-red-600 dark:hover:text-red-300"
          title="Stop any running session, clear all responses, and start fresh"
        >
          ↺ {running ? 'Stop & reset' : 'New question (clear results)'}
        </button>
      )}
    </section>
  )
}
