import { noDynamicServerBypass } from './orders-boundaries.mjs';

// Named Products public DTOs are consumed only by the order-item catalogue seam.
const scopes = {
  'src/modules/products/contracts.ts': [],
  'src/modules/products/browser.ts': ['./contracts'],
  'src/modules/orders/ui/catalogue-api.ts': ['../product-catalogue-contracts', '@/modules/products/browser'],
  'src/modules/products/domain/validation.ts': ['../contracts'],
  'src/modules/products/application/catalogue.ts': ['../contracts', './ports/catalogue', '../domain/validation'],
  'src/modules/products/application/ports/catalogue.ts': ['../../contracts'],
  'src/modules/orders/application/product-catalogue.ts': ['../product-catalogue-contracts', './ports/product-catalogue'],
  'src/modules/orders/application/ports/product-catalogue.ts': ['@/modules/products/contracts'],
  'src/modules/orders/product-catalogue-contracts.ts': ['@/modules/products/contracts'],
  'src/modules/products/infrastructure/postgres/catalogue.ts': ['server-only', '@/infrastructure/persistence/postgres/database', '../../contracts', '../../application/ports/catalogue'],
  'src/modules/orders/infrastructure/postgres/product-catalogue.ts': ['server-only', '@/infrastructure/persistence/postgres/database', '../../application/ports/product-catalogue'],
  'src/modules/products/server.ts': ['server-only', './application/catalogue', './domain/validation', './infrastructure/postgres/catalogue'],
  'src/modules/orders/product-catalogue-server.ts': ['server-only', './application/product-catalogue', './application/ports/product-catalogue', './infrastructure/postgres/product-catalogue'],
  'src/composition/order-products.ts': ['server-only', '@/modules/products/server', '@/modules/orders/product-catalogue-server'],
};
export const productCatalogueBoundaries = Object.entries(scopes).map(([file, paths]) => ({
  files: [file],
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ regex: paths.length ? `^(?!(?:${paths.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$).+` : '.+', message: 'Use the exact product catalogue owner, public DTO or consumer port.' }] }],
    'no-restricted-syntax': [...noDynamicServerBypass, { selector: 'ExportAllDeclaration', message: 'Keep catalogue exports explicit.' }],
    ...(/\/(application|domain)\//.test(file) ? {
      'no-restricted-globals': ['error', 'process', 'Buffer', 'fetch', 'Date', 'crypto', 'performance'],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Inject effects through the catalogue port.' }],
    } : {}),
  },
}));
