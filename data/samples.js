/* ============================================================
 * samples.js — 文件名模式的预置示例集
 * Phase 3 启用。每套：{ id, name, files: string[] }
 * ============================================================ */

window.FileSamples = [
  {
    id: 'frontend',
    name: '前端项目',
    files: [
      'index.html', 'package.json', 'package-lock.json', 'tsconfig.json',
      'vite.config.ts', '.eslintrc.cjs', '.prettierrc', '.gitignore',
      'README.md', 'src/main.tsx', 'src/App.tsx', 'src/App.css',
      'src/components/Button.tsx', 'src/components/Modal.tsx',
      'src/hooks/useAuth.ts', 'src/utils/format.ts', 'src/styles/global.scss',
      'public/favicon.ico', 'public/logo.svg', 'dist/index.html',
      'dist/assets/index-a1b2c3.js', 'dist/assets/index-a1b2c3.css',
      'node_modules/react/index.js',
    ],
  },
  {
    id: 'backend',
    name: '后端项目',
    files: [
      'main.go', 'go.mod', 'go.sum', 'Dockerfile', 'docker-compose.yml',
      'Makefile', '.env', '.env.example', 'config/config.yaml',
      'internal/handler/user.go', 'internal/handler/order.go',
      'internal/service/auth.go', 'internal/repository/db.go',
      'internal/model/user.go', 'pkg/logger/logger.go',
      'migrations/001_init.sql', 'migrations/002_add_index.sql',
      'scripts/deploy.sh', 'test/user_test.go', 'api/openapi.yaml',
    ],
  },
  {
    id: 'media',
    name: '媒体文件',
    files: [
      'IMG_0001.jpg', 'IMG_0002.jpg', 'IMG_0003.JPG', 'DSC_1024.RAW',
      'photo-2026-05-26.png', 'screenshot 2026-05-01 at 10.30.png',
      'avatar.webp', 'banner@2x.png', 'icon-512.png', 'movie.1080p.mp4',
      'trailer.mov', 'song - artist.mp3', 'podcast_ep12.m4a',
      'voice memo.wav', 'animation.gif', 'design.psd', 'logo.ai',
      'render.exr', 'clip.MKV', 'untitled.tiff',
    ],
  },
  {
    id: 'docs',
    name: '文档资料',
    files: [
      'README.md', 'CHANGELOG.md', 'LICENSE', 'CONTRIBUTING.md',
      '需求文档 v2.docx', '项目计划.xlsx', '季度汇报.pptx',
      'invoice_2026-01.pdf', 'contract-final.pdf', 'notes.txt',
      'data.csv', 'export.json', 'config.toml', 'manual.html',
      '会议纪要-0526.md', 'résumé.pdf', '报销单(1).xls',
      'backup.tar.gz', 'archive.zip', 'draft~.docx',
    ],
  },
  {
    id: 'logs',
    name: '日志文件',
    files: [
      'access.log', 'error.log', 'app.log', 'app.log.1', 'app.log.2.gz',
      'access.log.2026-05-25', 'access.log.2026-05-26',
      'nginx-error.log', 'mysql-slow.log', 'syslog', 'kern.log',
      'debug-2026-05-26T10-30-00.log', 'audit.log', 'gc.log.0',
      'catalina.out', 'pm2-out.log', 'pm2-error.log',
      'crash_2026_05_26.dmp', 'metrics.log.gz', 'trace.0001.log',
    ],
  },
  {
    id: 'mixed',
    name: '混合目录',
    files: [
      '.DS_Store', '.gitignore', '.env.local', 'Thumbs.db',
      'report 2026.pdf', 'IMG_2048.jpeg', 'script.min.js',
      'style.css.map', 'data (copy).json', 'archive.tar.bz2',
      'video.final.FINAL.v3.mp4', 'a.b.c.txt', 'noextension',
      '中文文件名.docx', 'emoji-📁.png', 'space in name.log',
      'UPPERCASE.TXT', 'mixed_Case-123.Js', 'temp.tmp', 'core.dump',
    ],
  },
];
