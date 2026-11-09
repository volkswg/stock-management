#!/usr/bin/env python3
"""Private, offline evidence for all 23 tables. Does not authorize migration/cutover."""
import argparse
import json
from pathlib import Path
from core import CATALOG, digest, metrics, normalize, load_json
from profile import profile
from migrate import write_private

GROUPS = {
    'orders': ['orders', 'order_items', 'order_bills'],
    'shipments': ['shipments', 'shipment_orders'],
    'inventory': ['movements', 'movement_details', 'stock_counts', 'stock_adjustments'],
    'sales': ['sales_receipts', 'sales_receipt_items', 'sales_receipt_payments', 'sales_receipt_syncs', 'sales_profit_cost_overrides'],
    'expenses': ['expenses', 'expense_categories', 'shops'],
    'hr': ['employees', 'employee_compensations', 'employee_timesheets', 'employee_advances', 'payroll_settlements'],
    'line': ['user_state'],
}


def acceptance(source, archive, operational):
    if not source['spreadsheetId'] == archive['spreadsheetId'] == operational['spreadsheetId']:
        raise ValueError('source workbook identity differs')
    states = {'source': source, 'archive': archive, 'operational': operational}
    summaries = {k: metrics(v) for k, v in states.items()}
    normalized = {k: normalize(v) for k, v in states.items()}
    tables = {}
    for table, spec in CATALOG.items():
        values = {k: v[table] for k, v in summaries.items()}
        tables[table] = {
            'match': values['source'] == values['archive'] == values['operational'],
            'records': values,
            'sourceCellFingerprints': {k: digest(sorted([[r[spec['key']], r['source_row'], r['source_cells']] for r in v[table]])) for k, v in normalized.items()},
        }
    source_profile = profile(source)
    archive_verified = archive.get('archiveEvidence') == {'sourceChecksum': digest(source), 'fullSnapshotVerified': True}
    match = all(t['match'] for t in tables.values())
    return {
        'version': 1, 'sourceChecksum': digest(source), 'tableCount': len(tables),
        'recordReconciliation': 'passed' if match else 'failed', 'match': match,
        'tables': tables, 'profile': source_profile,
        'modules': {k: {'tables': names, 'recordsMatch': all(tables[t]['match'] for t in names),
                        'derivedBusinessAcceptance': 'pending-original-application-comparison'} for k, names in GROUPS.items()},
        'archiveBatchVerified': archive_verified,
        'recordValidationPassed': match and source_profile['readyForReview'] and archive_verified,
        # Matching raw fields is necessary but cannot establish derived stock,
        # payroll, refunds/net sales, permissions, recovery or source authority.
        'cutoverReady': False,
        'remainingGates': ['owner-source-and-target-approval', 'original-application-business-totals',
                           'hosted-security-performance-capacity', 'backup-restore-rehearsal',
                           'production-auth-monitoring', 'approved-write-freeze-and-activation'],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['source', 'archive', 'operational']: parser.add_argument(name)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    result = acceptance(*(load_json(Path(getattr(args, name)).read_text()) for name in ['source', 'archive', 'operational']))
    write_private(args.output, json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'match': result['match'], 'recordValidationPassed': result['recordValidationPassed'], 'tableCount': result['tableCount'], 'cutoverReady': False}))
    return 0 if result['recordValidationPassed'] else 1


if __name__ == '__main__':
    try: raise SystemExit(main())
    except Exception: raise SystemExit('Acceptance failed. Inspect restricted artifacts; do not continue migration.')
