"""Optional integration regression: python tests/manifestRouter.browser.py
Requires playwright, BeautifulSoup and Chromium. Website itself requires none.
Checks section-01 CSV routing against the actual section-06 / section-07 state.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZIP_DEFLATED
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import csv, hashlib

ROOT = Path(__file__).resolve().parents[1]
rows = []
for i in range(120):
    owner = f'G27_SV{i % 10 + 1:02d}'
    identifier = hashlib.sha256(f'image-{i}'.encode()).hexdigest()
    rows.append(dict(image_id=identifier, assigned_reviewer_id=owner, group_id='G27',
                     difficulty_weight=str(i % 7 + 1), status='not_started'))
fields = list(rows[0])

def write_csv(path, recs):
    with path.open('w', encoding='utf-8-sig', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(recs)

with TemporaryDirectory() as temp:
    tmp = Path(temp)
    full, member, invalid = (tmp / f for f in ['assignment_manifest.csv', 'G27_SV09.csv', 'invalid.csv'])
    write_csv(full, rows)
    write_csv(member, [x for x in rows if x['assigned_reviewer_id'] == 'G27_SV09'])
    invalid.write_text('image_id,assigned_reviewer_id\nnot_an_image,\n', encoding='utf-8')
    bundle = tmp / 'G27_all.zip'
    with ZipFile(bundle, 'w', ZIP_DEFLATED) as archive:
        archive.write(full, 'G27/assignment_manifest.csv')
        archive.write(member, 'G27/reports/G27_SV09.csv')
    soup = BeautifulSoup((ROOT / 'index.html').read_text(encoding='utf-8'), 'html.parser')
    for tag in soup.select('script,link[rel=stylesheet]'):
        tag.decompose()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content(str(soup))
        js = ROOT / 'src/scripts'
        for name in ['core-a67fe933b7b3.js', 'core-a7504b369507.js',
                     'core-3d9ebc9d3147.js', 'core-fbdd1da5a5fb.js',
                     'v419IntergroupReview.js', 'v417UnifiedUploadQC.js',
                     'v428MemberReady.js', 'v500MergeWorkspace.js',
                     'v700AssignmentEngine.js', 'v700AssignmentUI.js']:
            page.add_script_tag(content=(js / name).read_text(encoding='utf-8'))

        def snapshot():
            return page.evaluate('''() => ({
               total:state.manifest?.rows?.length||0,
               owners:new Set((state.manifest?.rows||[]).map(r=>r.assigned_reviewer_id)).size,
               source:state.fileOrigins.manifest,
               cards:document.querySelectorAll('#allocMembers .allocMemberCard').length,
               notice:document.getElementById('hubStatus').textContent,
               mergeUnlocked:document.getElementById('mergeLock').hidden
            })''')

        def upload(file):
            page.locator('#hubAnyFiles').set_input_files(str(file))
            page.wait_for_timeout(800)
            return snapshot()

        assert snapshot()['total'] == 0
        assert upload(member)['total'] == 0, 'Member CSV must never initialize manifest'
        # A renamed per-member extract must also fail even though it has every column.
        renamed = tmp / 'renamed' / 'assignment_manifest.csv'
        renamed.parent.mkdir()
        write_csv(renamed, [x for x in rows if x['assigned_reviewer_id'] == 'G27_SV09'])
        assert upload(renamed)['total'] == 0, 'Renamed single-member CSV cannot stand in for the group manifest'
        data = upload(full)
        assert (data['total'], data['owners'], data['cards'], data['mergeUnlocked']) == (120, 10, 10, True), data
        assert '120 ảnh · 10 thành viên' in page.locator('#hubManifestSummary').inner_text()

        assert upload(member)['total'] == 120, 'Member CSV must never replace manifest'
        bad_file = tmp / 'invalid_manifest' / 'assignment_manifest.csv'
        bad_file.parent.mkdir()
        bad_file.write_bytes(invalid.read_bytes())
        data = upload(bad_file)
        assert data['total'] == 120 and 'Không thể xử lý' in data['notice'], data
        data = upload(bundle)
        assert (data['total'], data['owners'], data['cards']) == (120, 10, 10), data
        assert 'G27/assignment_manifest.csv' in data['source']
        page.locator('label.allocMemberCard').filter(has_text='G27_SV10').locator('input').uncheck()
        page.locator('#allocPreview').click()
        plan = page.evaluate('window.YoloAllocation.getPlan()')
        assert len(plan['rows']) == 120 and len(plan['transfers']) == 12 and len(plan['active']) == 9
        assert not errors, errors
        browser.close()
print('PASS: member CSV ignored, real manifest loaded, invalid replacement rejected, ZIP with both parsed, 07 plan correct.')
