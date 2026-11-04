import { existsSync } from "node:fs";

// Same behavior tests run before and after relocation. Structural tests separately
// require moved files at their destination and reject duplicates/retired imports.
export function shipmentUiPath(file) {
  const target = `src/modules/shipments/ui/${file}`;
  return existsSync(target) ? target : `src/app/shipments/${file}`;
}

// Preserve inherited raw fingerprints while allowing ONLY the reviewed import
// location corrections. This does not replace any pre-move expected hash.
export function restoreRelocationImports(file, text) {
  const imports = {
    "src/app/shipments/page.tsx": ["@/modules/shipments/ui/ShipmentListPage", "./ShipmentListPage"],
    "src/app/shipments/loading.tsx": ["@/modules/shipments/ui/shipments.module.css", "./shipments.module.css"],
    "src/app/shipments/[id]/page.tsx": ["@/modules/shipments/ui/[id]/ShipmentDetailPage", "./ShipmentDetailPage"],
    "src/app/shipments/[id]/loading.tsx": ["@/modules/shipments/ui/[id]/shipmentDetail.module.css", "./shipmentDetail.module.css"],
  };
  if (imports[file]) text = text.replace(`"${imports[file][0]}"`, `"${imports[file][1]}"`);
  if (file === "eslint/orders-boundaries.mjs") text = text.replaceAll("src/modules/shipments/ui/", "src/app/shipments/");
  return text;
}
