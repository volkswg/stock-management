import unittest
from core import CATALOG
from profile import profile

def valid():
    snapshot={'version':1,'spreadsheetId':'synthetic-only','sheets':{t:{'headers':s['headers'],'rows':[]} for t,s in CATALOG.items()}}
    snapshot['sheets']['orders']['rows']=[['synthetic','complete','Synthetic','12.34','','2026-11-01T01:00:00+07:00','2026-11-01T01:00:00+07:00','','synthetic']]
    return snapshot

class ProfileTests(unittest.TestCase):
    def test_profile_types_and_exact_totals_without_repair(self):
        report=profile(valid())
        self.assertTrue(report['readyForReview'])
        self.assertEqual(report['tables']['orders']['totals']['totalPrice'],'12.34')
        self.assertEqual(report['tables']['orders']['dateShapes']['createdAt'],{'timestamp':1})
    def test_profile_duplicates_and_invalid_dates_stop_acceptance(self):
        snapshot=valid();snapshot['sheets']['orders']['rows'][0][5]='2026-99-99'
        snapshot['sheets']['orders']['rows']*=2
        report=profile(snapshot)
        self.assertFalse(report['readyForReview'])
        self.assertTrue(any(p['problem']=='duplicate IDs' for p in report['problems']))
        self.assertTrue(any('date format' in p['problem'] for p in report['problems']))
    def test_orphan_and_bad_number_are_reported_together(self):
        snapshot=valid();snapshot['sheets']['orders']['rows'][0][3]='NaN'
        snapshot['sheets']['order_items']['rows']=[['item','missing','',1,1,'','','','','']]
        report=profile(snapshot)
        self.assertFalse(report['readyForReview'])
        self.assertTrue(any(p['problem']=='orphan relationship' for p in report['problems']))
        self.assertTrue(any(p['problem']=='invalid value for target type' for p in report['problems']))
    def test_formatted_money_and_formula_cells_require_compatibility_review(self):
        snapshot=valid();sheet=snapshot['sheets']['orders']
        sheet['formattedRows']=[list(sheet['rows'][0])];sheet['formattedRows'][0][3]='฿12.34'
        sheet['formulaRows']=[['synthetic','','','=6.17*2']]
        report=profile(snapshot)
        self.assertFalse(report['readyForReview'])
        self.assertTrue(any('formatted numeric' in p['problem'] for p in report['problems']))
        self.assertTrue(any('formula-like' in p['problem'] for p in report['problems']))
    def test_naive_timestamp_is_not_assigned_an_invented_timezone(self):
        snapshot=valid();snapshot['sheets']['orders']['rows'][0][5]='2026-11-01T01:00:00'
        report=profile(snapshot)
        self.assertFalse(report['readyForReview'])
        self.assertEqual(snapshot['sheets']['orders']['rows'][0][5],'2026-11-01T01:00:00')
    def test_blank_numeric_display_cannot_hide_unformatted_money(self):
        snapshot=valid();sheet=snapshot['sheets']['orders']
        sheet['formattedRows']=[list(sheet['rows'][0])];sheet['formattedRows'][0][3]=''
        self.assertFalse(profile(snapshot)['readyForReview'])
