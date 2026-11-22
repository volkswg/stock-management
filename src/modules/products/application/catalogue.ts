import type { ProductCreateInput } from '../contracts';
import type { ProductStore } from './ports/catalogue';
import { ProductError,productInput,productId,revision } from '../domain/validation';
export function catalogue(store:ProductStore) {
  return {
    search(query:string) { if(query.length>200)throw new ProductError('Search is too long.'); return store.search(query.trim()); },
    async find(id:string) { return store.find(productId(id)); },
    async create(input:ProductCreateInput) {
      const fields=productInput(input);
      if(input.referenceImageMediaId!==null && !(await store.mediaExists(input.referenceImageMediaId)))throw new ProductError('The reference image is no longer available.',409);
      const similar=await store.similar(fields);
      if(similar.length && input.confirmSimilar!==true)throw new ProductError('Similar products exist. Review them and confirm creation or choose an existing product.',409,'product_similar');
      return store.create(fields,input.referenceImageMediaId);
    },
    async update(id:string,expected:string,input:unknown) {
      const result=await store.update(productId(id),revision(expected),productInput(input));
      if(!result)throw new ProductError('This product changed or was archived. Refresh and review your edit.',409,'product_revision_conflict');return result;
    },
    async archive(id:string,expected:string) {
      const result=await store.archive(productId(id),revision(expected));
      if(!result)throw new ProductError('This product changed or was archived. Refresh before continuing.',409,'product_revision_conflict');return result;
    },
  };
}
