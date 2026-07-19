// Light/dark theme persistence for the side panel. The choice lives in
// localStorage and is applied as data-theme on <html>, which flips the CSS
// variables in index.css. Default is dark. See ADR-0005.
const KEY = 'llmc-theme'

export function initialTheme() {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark'
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}
