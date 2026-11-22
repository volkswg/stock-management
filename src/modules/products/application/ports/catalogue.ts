import type { Product, ProductInput } from '../../contracts';
export interface ProductStore {
  search(query:string):Promise<Product[]>;
  similar(input:ProductInput):Promise<Product[]>;
  find(id:string):Promise<Product|undefined>;
  mediaExists(id:string):Promise<boolean>;
  create(input:ProductInput,mediaId:string|null):Promise<Product>;
  update(id:string,expected:string,input:ProductInput):Promise<Product|undefined>;
  archive(id:string,expected:string):Promise<Product|undefined>;
}
