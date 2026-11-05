from pathlib import Path
import json, shutil
ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)
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
(DIST / 'index.html').write_text((DIST / 'forest.html').read_text())
print('Built four themes in dist/')
