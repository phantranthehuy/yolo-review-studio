from pathlib import Path
import json, shutil
ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)
# The Dark mode belongs to the shared Sáng/Tối switch, not a separate HTML page.
for obsolete in (ROOT / 'dark.html', DIST / 'dark.html'):
    if obsolete.exists(): obsolete.unlink()
for folder in ('styles', 'scripts'):
    shutil.copytree(ROOT / 'src' / folder, DIST / 'assets' / folder, dirs_exist_ok=True)
shutil.copytree(ROOT / 'public/images', DIST / 'assets/images', dirs_exist_ok=True)
shutil.copytree(
    ROOT / 'public/icons',
    DIST / 'assets/icons',
    dirs_exist_ok=True
)
template = (ROOT / 'src/template.html').read_text()
themes = json.loads((ROOT / 'config/themes.json').read_text())
for name, settings in themes.items():
    html = template.replace('{{THEME_ASSETS}}', settings['decoration'])
    html = html.replace('href="' + name + '.html"', 'aria-current="page" href="' + name + '.html"')
    (DIST / (name + '.html')).write_text(html)
# Plain default theme is intentionally the starting screen for uncluttered QC work.
(DIST / 'index.html').write_text((DIST / 'default.html').read_text())
print(f'Built {len(themes)} themes in dist/')

# Keep root-level entry pages and assets in sync. Users normally open ./index.html.
for folder in ('styles','scripts'):
    shutil.copytree(ROOT/'src'/folder, ROOT/'assets'/folder, dirs_exist_ok=True)
for page in ('index.html', *[name + '.html' for name in themes]):
    shutil.copy2(DIST/page, ROOT/page)
print('Synced root-level index.html and theme assets.')
