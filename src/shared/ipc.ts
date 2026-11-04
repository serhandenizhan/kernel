// IPC kanal adları — ana süreç ve preload aynı sabitleri kullanır
export const IPC = {
  vaultInfo: 'vault:info',
  vaultChoose: 'vault:choose',
  vaultReveal: 'vault:reveal',
  pagesTree: 'pages:tree',
  pagesRead: 'pages:read',
  pagesWrite: 'pages:write',
  pagesCreate: 'pages:create',
  pagesRename: 'pages:rename',
  pagesMove: 'pages:move',
  pagesTrash: 'pages:trash',
  attachmentsSave: 'attachments:save',
  attachmentsFetchRemote: 'attachments:fetch-remote',
  searchQuery: 'search:query',
  searchRecent: 'search:recent',
  pdfExport: 'pdf:export',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  appFlush: 'app:flush',
  appFlushDone: 'app:flush-done',
  eventTreeChanged: 'event:tree-changed',
  eventPageChanged: 'event:page-changed'
} as const
