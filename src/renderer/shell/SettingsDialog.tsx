import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { useStore } from '../state/store'
import { kernel } from '../lib/kernel'
import { isMac } from '../lib/platform'
import { FONT_PACKS } from '../lib/font-packs'
import { useLang, useT } from '../lib/i18n'
import { localeOf } from '@shared/i18n'

// Ayarlar (Cmd+,): görünüm, yapıştırma, ipuçları, kasa
export function SettingsDialog() {
  const settings = useStore((s) => s.settings)
  const vaultPath = useStore((s) => s.vaultPath)
  const set = (patch: Partial<Settings>) => void useStore.getState().setSettings(patch)
  const close = () => useStore.getState().setOverlay(null)
  const t = useT()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div className="modal settings glass" role="dialog" aria-label={t('settings.title')} data-testid="settings-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{t('settings.title')}</h3>
          <button className="icon-btn modal-close" data-testid="settings-close" title={t('settings.close')} aria-label={t('settings.close')} onClick={() => useStore.getState().setOverlay(null)}>
            ×
          </button>
        </div>

        <section>
          <h4>{t('settings.appearance')}</h4>
          <div className="setting-row">
            <span>{t('settings.theme')}</span>
            <Segmented
              testid="setting-theme"
              label={t('settings.theme')}
              value={settings.theme}
              options={[
                { value: 'system', label: t('settings.theme.system') },
                { value: 'light', label: t('settings.theme.light') },
                { value: 'dark', label: t('settings.theme.dark') }
              ]}
              onChange={(theme) => set({ theme })}
            />
          </div>
          <div className="setting-row">
            <span>{t('settings.language')}</span>
            <Segmented
              testid="setting-language"
              label={t('settings.language')}
              value={settings.language}
              options={[
                { value: 'system', label: t('settings.language.system') },
                { value: 'tr', label: 'Türkçe' },
                { value: 'en', label: 'English' },
                { value: 'de', label: 'Deutsch' }
              ]}
              onChange={(language) => set({ language })}
            />
          </div>
          <p className="setting-hint">{t('settings.language.hint')}</p>
          <div className="setting-stack">
            <span>{t('settings.font')}</span>
            <FontPackPicker value={settings.bodyFont} label={t('settings.font')} onChange={(bodyFont) => set({ bodyFont })} />
          </div>
          <p className="setting-hint">{t('settings.font.hint')}</p>
          <div className="setting-row">
            <span>{t('settings.start')}</span>
            <Segmented
              testid="setting-start"
              label={t('settings.start')}
              value={settings.startView}
              options={[
                { value: 'home', label: t('settings.start.home') },
                { value: 'last', label: t('settings.start.last') }
              ]}
              onChange={(startView) => set({ startView })}
            />
          </div>
          <div className="setting-row">
            <span>{t('settings.width')}</span>
            <Segmented
              testid="setting-width"
              label={t('settings.width')}
              value={settings.pageWidth}
              options={[
                { value: 'narrow', label: t('settings.width.narrow') },
                { value: 'normal', label: t('settings.width.normal') },
                { value: 'wide', label: t('settings.width.wide') }
              ]}
              onChange={(pageWidth) => set({ pageWidth })}
            />
          </div>
        </section>

        <section>
          <h4>{t('settings.paste')}</h4>
          <label className="setting-check">
            <input type="checkbox" data-testid="setting-strip-citations" checked={settings.paste.stripCitations} onChange={(e) => set({ paste: { ...settings.paste, stripCitations: e.target.checked } })} />
            {t('settings.paste.citations')}
          </label>
          <label className="setting-check">
            <input type="checkbox" checked={settings.paste.latexLineHeuristic} onChange={(e) => set({ paste: { ...settings.paste, latexLineHeuristic: e.target.checked } })} />
            {t('settings.paste.latex')}
          </label>
          <label className="setting-check">
            <input type="checkbox" checked={settings.paste.unfencedCodeHeuristic} onChange={(e) => set({ paste: { ...settings.paste, unfencedCodeHeuristic: e.target.checked } })} />
            {t('settings.paste.code')}
          </label>
        </section>

        <section>
          <h4>{t('settings.tips')}</h4>
          <label className="setting-check">
            <input type="checkbox" checked={settings.tips.enabled} onChange={(e) => set({ tips: { ...settings.tips, enabled: e.target.checked } })} />
            {t('settings.tips.enabled')}
          </label>
          <button className="btn small" onClick={() => set({ tips: { ...settings.tips, seen: [] }, tourDone: false })}>
            {t('settings.tips.reset')}
          </button>
        </section>

        <section>
          <h4>{t('settings.updates')}</h4>
          <label className="setting-check">
            <input
              type="checkbox"
              data-testid="setting-update-check"
              checked={settings.updates.check}
              onChange={(e) => set({ updates: { ...settings.updates, check: e.target.checked } })}
            />
            {t('settings.updates.check')}
          </label>
          <UpdateCheckNow />
          <p className="setting-hint">{t('settings.updates.hint')}</p>
        </section>

        <BackupSection />

        <NotionSection />

        <section>
          <h4>{t('settings.vault')}</h4>
          <div className="setting-path">{vaultPath}</div>
          <div className="setting-actions">
            <button className="btn small" onClick={() => void kernel.vault.reveal('')}>
              {t(isMac ? 'settings.vault.reveal' : 'settings.vault.revealWin')}
            </button>
            <button
              className="btn small"
              onClick={async () => {
                const res = await kernel.vault.choose(false)
                if (res) {
                  close()
                  await useStore.getState().init()
                }
              }}
            >
              {t('settings.vault.choose')}
            </button>
          </div>
        </section>

        <div className="modal-actions">
          <button className="btn primary" onClick={close}>
            {t('settings.done')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Segment kontrolü (radyo grubu); seçenek testid'i `${testid}-${value}` */
// Yazı tipi paketi seçicisi: her kart paketin adını kendi başlık yazı tipiyle gösterir
function FontPackPicker({ value, label, onChange }: { value: Settings['bodyFont']; label: string; onChange(v: Settings['bodyFont']): void }) {
  return (
    <div className="font-packs" role="radiogroup" aria-label={label} data-testid="setting-font">
      {FONT_PACKS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="radio"
          aria-checked={p.id === value}
          data-testid={`setting-font-${p.id}`}
          className={`font-pack${p.id === value ? ' on' : ''}`}
          onClick={() => onChange(p.id)}
        >
          <span className="font-pack-name" style={{ fontFamily: p.preview, fontWeight: p.previewWeight }}>
            {p.name}
          </span>
          <span className="font-pack-fonts">{p.fonts}</span>
        </button>
      ))}
    </div>
  )
}

function Segmented<V extends string>({ testid, label, value, options, onChange }: { testid: string; label: string; value: V; options: { value: V; label: string; className?: string }[]; onChange(v: V): void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label} data-testid={testid}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          data-testid={`${testid}-${o.value}`}
          className={`segment${o.value === value ? ' on' : ''}${o.className ? ` ${o.className}` : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function BackupSection() {
  const backup = useStore((s) => s.settings.backup)
  const [last, setLast] = useState<string | null>(null)
  const refresh = () => void kernel.backup.status().then((s) => setLast(s.last))
  useEffect(refresh, [])
  const t = useT()
  const lang = useLang()
  const set = (patch: Partial<typeof backup>) => void useStore.getState().setSettings({ backup: { ...backup, ...patch } })
  const lastText = last ? (Date.now() - new Date(last).getTime() < 120_000 ? t('settings.backup.justNow') : new Date(last).toLocaleString(localeOf(lang))) : t('settings.backup.never')
  return (
    <section>
      <h4>{t('settings.backup')}</h4>
      <label className="setting-check">
        <input type="checkbox" data-testid="setting-backup" checked={backup.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        {t('settings.backup.enabled', { keep: backup.keep })}
      </label>
      <div className="setting-path" data-testid="backup-folder">
        {backup.folder ?? t('settings.backup.noFolder')}
      </div>
      <div className="setting-actions">
        <button
          className="btn small"
          data-testid="backup-choose"
          onClick={async () => {
            const folder = await kernel.backup.chooseFolder()
            if (folder) await useStore.getState().setSettings({ backup: { ...useStore.getState().settings.backup, folder } })
          }}
        >
          {t('settings.backup.choose')}
        </button>
        <button
          className="btn small"
          data-testid="backup-now"
          disabled={!backup.folder}
          onClick={async () => {
            const res = await kernel.backup.now()
            if ('filePath' in res) useStore.getState().toast(t('settings.backup.done'))
            refresh()
          }}
        >
          {t('settings.backup.now')}
        </button>
      </div>
      <div className="setting-hint" data-testid="backup-last">
        {t('settings.backup.last', { when: lastText })}
      </div>
    </section>
  )
}

function NotionSection() {
  const t = useT()
  const [connected, setConnected] = useState(false)
  useEffect(() => void kernel.notion.connected().then(setConnected), [])
  if (!connected) return null
  return (
    <section>
      <h4>Notion</h4>
      <p className="setting-hint">{t('settings.notion.hint')}</p>
      <button
        className="btn small"
        data-testid="notion-disconnect"
        onClick={async () => {
          await kernel.notion.disconnect()
          setConnected(false)
          useStore.getState().toast(t('settings.notion.disconnected'))
        }}
      >
        {t('settings.notion.disconnect')}
      </button>
    </section>
  )
}

// Elle sürüm denetimi: yeni sürüm varsa köşedeki güncelleme penceresi açılır, yoksa durum yazılır
function UpdateCheckNow() {
  const t = useT()
  const [state, setState] = useState<{ status: 'idle' | 'checking' | 'available' | 'current' | 'error'; current?: string }>({ status: 'idle' })
  const run = async () => {
    setState({ status: 'checking' })
    const r = await kernel.updates.checkNow().catch(() => ({ status: 'error' as const, current: '' }))
    if (r.status === 'available' && r.offer) useStore.getState().setUpdateOffer(r.offer)
    setState({ status: r.status, current: r.current })
  }
  const label =
    state.status === 'checking'
      ? t('settings.updates.checking')
      : state.status === 'current'
        ? t('settings.updates.current', { version: state.current ?? '' })
        : state.status === 'available'
          ? t('settings.updates.available')
          : state.status === 'error'
            ? t('settings.updates.error')
            : ''
  return (
    <div className="setting-row">
      <button className="btn small" data-testid="setting-update-now" disabled={state.status === 'checking'} onClick={() => void run()}>
        {t('settings.updates.now')}
      </button>
      <span className="setting-hint" data-testid="setting-update-status" aria-live="polite">
        {label}
      </span>
    </div>
  )
}
