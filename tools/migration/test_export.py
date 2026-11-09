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
from migrate import main, RefuseRedirect

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
                    if table=='orders' and not query['ranges'][0].endswith('!1:1'):
                        rows.append([2,'complete','Synthetic',12.34,'','2026-11-01','2026-11-01','','synthetic'])
                        if mode=='FORMATTED_VALUE':rows[1]=['0002','complete','Synthetic','12.34','','2026-11-01','2026-11-01','','synthetic']
                    entries.append({'values':rows})
                payload={'valueRanges':entries}
            return io.BytesIO(json.dumps(payload).encode())
        with tempfile.TemporaryDirectory() as directory:
            mapping=Path(directory,'mapping.json');output=Path(directory,'export.json')
            mapping.write_text(json.dumps({t:t for t in CATALOG}))
            argv=['migrate.py','export','--workbook','synthetic-only','--mapping',str(mapping),'--output',str(output)]
            with patch('sys.argv',argv),patch.dict(os.environ,{'GOOGLE_SHEETS_READONLY_TOKEN':'synthetic'}),patch('urllib.request.OpenerDirector.open',side_effect=response),contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main(),0)
            snapshot=json.loads(output.read_text());order=snapshot['sheets']['orders']
            self.assertEqual(len(calls),8)
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

    def test_bad_header_stops_before_any_business_or_credential_row_capture(self):
        calls=[]
        def response(request,timeout):
            calls.append(request.full_url)
            query=parse_qs(urlparse(request.full_url).query)
            if 'fields' in query:return io.BytesIO(json.dumps({'sheets':[{'properties':{'title':t}} for t in CATALOG]}).encode())
            self.assertTrue(all(r.endswith('!1:1') for r in query['ranges']))
            return io.BytesIO(json.dumps({'valueRanges':[{'values':[['id','accessToken']]} for t in CATALOG]}).encode())
        with tempfile.TemporaryDirectory() as directory:
            mapping=Path(directory,'mapping.json');mapping.write_text(json.dumps({t:t for t in CATALOG}))
            output=Path(directory,'source.json')
            with patch('sys.argv',['migrate.py','export','--workbook','synthetic','--mapping',str(mapping),'--output',str(output)]),patch.dict(os.environ,{'GOOGLE_SHEETS_READONLY_TOKEN':'synthetic'}),patch('urllib.request.OpenerDirector.open',side_effect=response):
                with self.assertRaises(ValueError):main()
            self.assertEqual(len(calls),2);self.assertFalse(output.exists())

    def test_credential_mapping_is_rejected_before_token_or_network_access(self):
        with tempfile.TemporaryDirectory() as directory:
            mapping=Path(directory,'mapping.json');value={t:t for t in CATALOG};value['orders']=' LOYVERSE_ACCOUNTS ';mapping.write_text(json.dumps(value))
            with patch('sys.argv',['migrate.py','export','--workbook','synthetic','--mapping',str(mapping),'--output',str(Path(directory,'unused')),'--dry-run']),patch.dict(os.environ,{},clear=True),patch('urllib.request.OpenerDirector.open',side_effect=AssertionError('network forbidden')):
                with self.assertRaises(ValueError):main()

    def test_redirect_cannot_forward_readonly_bearer_to_another_origin(self):
        request=__import__('urllib.request',fromlist=['Request']).Request('https://sheets.googleapis.com/v4/spreadsheets/synthetic',headers={'Authorization':'Bearer synthetic'})
        with self.assertRaises(ValueError):RefuseRedirect().redirect_request(request,None,302,'Found',{},'https://unapproved.invalid/')
