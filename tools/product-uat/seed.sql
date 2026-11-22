-- Synthetic local UAT only; never a production data import.
INSERT INTO stock_operational.orders(id,status,seller,"totalPrice",remark,"createdAt","updatedAt","createdBy")
VALUES('UAT-PRODUCT-ORDER','draft','Synthetic UAT supplier',120,'Synthetic order for product catalogue UAT','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z','synthetic-uat');
INSERT INTO stock_operational.media(id,provider,"sourceUrl","fileName","createdBy")
VALUES('b64a44de-c826-4418-8792-3b3053121825','external_url','/product-uat-demo.svg','synthetic-product.svg','synthetic-uat');
INSERT INTO stock_operational.order_items("orderId","productCode","quoteQuantity","deliveredQuantity","imageMediaId","createdAt","updatedAt","createdBy")
VALUES('UAT-PRODUCT-ORDER','UAT-CHAIR',3,1,'b64a44de-c826-4418-8792-3b3053121825','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z','synthetic-uat'),
('UAT-PRODUCT-ORDER','UAT-CHAIR',2,0,'b64a44de-c826-4418-8792-3b3053121825','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z','synthetic-uat');
