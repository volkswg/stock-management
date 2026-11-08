import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs
from core import CATALOG, normalize
from migrate import main

class ExportTests(unittest.TestCase):
    def test_batch_export_preserves_formatted_business_ids_exact_numbers_and_original_renderings(self):
        calls=[]
        def response(request,timeout):
            calls.append(request.full_url);query=parse_qs(urlparse(request.full_url).query)
            if 'fields' in query:
                payload={'sheets':[{'properties':{'title':table}} for table in CATALOG]}
            else:
                self.assertEqual(len(query['ranges']),23)
                mode=query['valueRenderOption'][0];entries=[]
                for table,spec in CATALOG.items():
                    rows=[spec['headers']]
                    if table=='orders':
                        rows.append([2,'complete','Synthetic',12.34,'','2026-11-01','2026-11-01','','synthetic'])
                        if mode=='FORMATTED_VALUE':rows[1]=['0002','complete','Synthetic','12.34','','2026-11-01','2026-11-01','','synthetic']
                    entries.append({'values':rows})
                payload={'valueRanges':entries}
            return io.BytesIO(json.dumps(payload).encode())
        with tempfile.TemporaryDirectory() as directory:
            mapping=Path(directory,'mapping.json');output=Path(directory,'export.json')
            mapping.write_text(json.dumps({t:t for t in CATALOG}))
            argv=['migrate.py','export','--workbook','synthetic-only','--mapping',str(mapping),'--output',str(output)]
            with patch('sys.argv',argv),patch.dict(os.environ,{'GOOGLE_SHEETS_READONLY_TOKEN':'synthetic'}),patch('urllib.request.urlopen',side_effect=response),contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main(),0)
            snapshot=json.loads(output.read_text());order=snapshot['sheets']['orders']
            self.assertEqual(len(calls),7)
            self.assertEqual(order['rows'][0][0],'0002')
            self.assertEqual(order['rawRows'][0][0],2)
            self.assertEqual(order['rawCellTypes'][0][3],'number')
            self.assertEqual(normalize(snapshot)['orders'][0]['totalPrice'],'12.34')
            self.assertEqual(output.stat().st_mode & 0o777,0o600)
    def test_export_dry_run_never_reads_a_token_or_calls_google(self):
        with tempfile.TemporaryDirectory() as directory:
            mapping=Path(directory,'mapping.json');mapping.write_text(json.dumps({t:t for t in CATALOG}))
            with patch('sys.argv',['migrate.py','export','--workbook','synthetic','--mapping',str(mapping),'--output',str(Path(directory,'unused')),'--dry-run']),patch.dict(os.environ,{},clear=True),patch('urllib.request.urlopen',side_effect=AssertionError('network forbidden')),contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main(),0)
