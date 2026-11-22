import type {Metadata} from 'next';
import {ProductMasterPage} from '@/modules/products/ui/ProductMasterPage';
export const metadata:Metadata={title:'Product Master',description:'Search and manage the product catalogue.'};
export default function ProductsPage(){return <ProductMasterPage/>;}
