/* ==========================================================
   APP BOOT
   Loaded last. Wires keyboard shortcuts, applies saved theme,
   seeds the demo world, and renders.
   ========================================================== */

/* ---------- KEYBOARD ---------- */
document.addEventListener('keydown', e => {
  // When typing into a field, only handle Escape (blur out)
  if (e.target.matches('input, textarea, select')) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  // ignore plain typing modifiers being held alone (ctrl, etc.)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openCreateModal(); return; }
  if (e.key === '/') {
    e.preventDefault();
    if (UI.view !== 'codex') { UI.view = 'codex'; UI.filterType = 'all'; renderSidebar(); renderView(); }
    setTimeout(() => $('#codexSearch')?.focus(), 50);
    return;
  }
  if (e.key === 'Escape') {
    if ($('#modalOverlay')?.classList.contains('open')) closeModal();
    else closeInspector();
    return;
  }
  if (e.key === 't' || e.key === 'T') { toggleTheme(); return; }

  const viewMap = { '1':'dashboard', '2':'graph', '3':'timeline', '4':'map',
                    '5':'systems', '6':'consistency', '7':'notes' };
  if (viewMap[e.key]) {
    UI.view = viewMap[e.key];
    closeInspector();
    renderSidebar();
    renderView();
  }
});

/* ---------- BOOT ---------- */
function boot() {
  const prefersLight = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: light)').matches;
  applyTheme(prefersLight ? 'light' : 'dark');
  showSplash();
}

// Run boot once the DOM is parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
