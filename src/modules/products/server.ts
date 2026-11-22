import 'server-only';
import {catalogue} from './application/catalogue';
import {PostgresProducts} from './infrastructure/postgres/catalogue';
export {ProductError} from './domain/validation';
export function createProductCatalogue(){return catalogue(new PostgresProducts());}
