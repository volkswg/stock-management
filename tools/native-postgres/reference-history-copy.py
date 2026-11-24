"""Hash-pinned PR93 copy for its unchanged coupled-identity historical campaign.
Current removal acceptance always runs actual current source on separate copies.
"""
from pathlib import Path
import hashlib,json,os,sys
from pooling_history import before_pooling, before_seller
ROOT=Path(__file__).resolve().parents[2]
def copy_previous(target):
 target=Path(target)
 if target.exists() and any(target.iterdir()):raise ValueError('Destination must be empty')
 retirement=json.loads((ROOT/'tests/fixtures/receipt-payment-retirement-before.json').read_text())
 products=json.loads((ROOT/'tests/fixtures/product-master-uat-before.json').read_text())
 wrappers = json.loads((ROOT/'tests/fixtures/wrapper-cleanup-before.json').read_text())
 naming=json.loads((ROOT/'tests/fixtures/sales-naming-before.json').read_text())
 shipment=json.loads((ROOT/'tests/fixtures/order-detail-shipment-before.json').read_text())
 jsonb=json.loads((ROOT/'tests/fixtures/receipt-payments-jsonb-before.json').read_text())
 payment=json.loads((ROOT/'tests/fixtures/single-receipt-payment-before.json').read_text())
 lean=json.loads((ROOT/'tests/fixtures/lean-loyverse-before.json').read_text())
 row_edits=json.loads((ROOT/'tests/fixtures/row-edits-before.json').read_text())
 cleanup=json.loads((ROOT/'tests/fixtures/safe-compatibility-cleanup-before.json').read_text())
 uploads=json.loads((ROOT/'tests/fixtures/order-image-uploads-before.json').read_text())
 fixture=json.loads((ROOT/'tests/fixtures/movement-reference-before.json').read_text())
 for name,expected in fixture['files'].items():
  source=ROOT/name;data=source.read_bytes() if source.exists() else None;edit=fixture['edits'].get(name)
  data=before_seller(name,data)
  movement_edit=json.loads((ROOT/'tests/fixtures/movement-shop-ids-before.json').read_text())['edits'].get(name)
  if movement_edit:
      assert (hashlib.sha256(data).hexdigest() if data is not None else None)==movement_edit['afterSha256'],name
      data=movement_edit['before'].encode()
      assert hashlib.sha256(data).hexdigest()==movement_edit['beforeSha256'],name
  data=before_pooling(name,data)
  product_edit=products['edits'].get(name)
  if product_edit:
      assert (hashlib.sha256(data).hexdigest() if data is not None else None)==product_edit['afterSha256'],name
      data=product_edit['before'].encode()
      assert hashlib.sha256(data).hexdigest()==product_edit['beforeSha256'],name
  wrapper_edit = wrappers['edits'].get(name)
  if wrapper_edit:
      assert (hashlib.sha256(data).hexdigest() if data is not None else None) == wrapper_edit['afterSha256'], name
      data = wrapper_edit['before'].encode()
      assert hashlib.sha256(data).hexdigest() == wrapper_edit['beforeSha256'], name
  naming_edit=naming['edits'].get(name)
  if naming_edit:
      assert (hashlib.sha256(data).hexdigest() if data is not None else None)==naming_edit['afterSha256'],name
      data=naming_edit['before'].encode()
      assert hashlib.sha256(data).hexdigest()==naming_edit['beforeSha256'],name
  shipment_edit=shipment['edits'].get(name)
  if shipment_edit:
      assert (hashlib.sha256(data).hexdigest() if data is not None else None)==shipment_edit['afterSha256'],name
      data=shipment_edit['before'].encode()
      assert hashlib.sha256(data).hexdigest()==shipment_edit['beforeSha256'],name
  retirement_edit=retirement['edits'].get(name)
  if retirement_edit:
      assert (hashlib.sha256(data).hexdigest() if data is not None else None)==retirement_edit['afterSha256'],name
      data=retirement_edit['before'].encode()
      assert hashlib.sha256(data).hexdigest()==retirement_edit['beforeSha256'],name
  jsonb_edit=jsonb['edits'].get(name)
  if jsonb_edit:
      assert (hashlib.sha256(data).hexdigest() if data is not None else None)==jsonb_edit['afterSha256'],name
      data=jsonb_edit['before'].encode()
      assert hashlib.sha256(data).hexdigest()==jsonb_edit['beforeSha256'],name
  payment_edit=payment['edits'].get(name)
  if payment_edit:
      assert (hashlib.sha256(data).hexdigest() if data is not None else None)==payment_edit['afterSha256'],name
      data=payment_edit['before'].encode()
      assert hashlib.sha256(data).hexdigest()==payment_edit['beforeSha256'],name
  lean_edit=lean['edits'].get(name)
  if lean_edit:
   assert (hashlib.sha256(data).hexdigest() if data is not None else None)==lean_edit['afterSha256'],name
   data=lean_edit['before'].encode();assert hashlib.sha256(data).hexdigest()==lean_edit['beforeSha256'],name
  row_edit=row_edits['edits'].get(name)
  if row_edit:
   assert (hashlib.sha256(data).hexdigest() if data is not None else None)==row_edit['afterSha256'],name
   data=row_edit['before'].encode();assert hashlib.sha256(data).hexdigest()==row_edit['beforeSha256'],name
  cleanup_edit=cleanup['edits'].get(name)
  if cleanup_edit:
   assert (hashlib.sha256(data).hexdigest() if data is not None else None)==cleanup_edit['afterSha256'],name
   data=cleanup_edit['before'].encode();assert hashlib.sha256(data).hexdigest()==cleanup_edit['beforeSha256'],name
  upload_edit=uploads['edits'].get(name)
  if upload_edit:
   assert (hashlib.sha256(data).hexdigest() if data is not None else None)==upload_edit['afterSha256'],name
   data=upload_edit['before'].encode();assert hashlib.sha256(data).hexdigest()==upload_edit['beforeSha256'],name
  if edit:
   assert (hashlib.sha256(data).hexdigest() if data is not None else None)==edit['afterSha256'],name
   data=edit['before'].encode()
  assert data is not None and hashlib.sha256(data).hexdigest()==expected,name
  dest=target/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
 os.symlink((ROOT/'node_modules').resolve(),target/'node_modules',target_is_directory=True)
 assert not (target/'.vercel').exists() and not (target/'.git').exists()
 assert not list(target.glob('.env*')) or {p.name for p in target.glob('.env*')}=={'.env.example'}
 return target
if __name__=='__main__':copy_previous(sys.argv[1])
