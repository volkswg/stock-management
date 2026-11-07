import {ordersLineGraph} from './orders-line-source.mjs';
// Same closed source graph as the original/current workflow comparisons; all IO is fake.
export function ordersServer(options={}) {
 return ordersLineGraph({createId:()=>"synthetic-order-id",...options}).load;
}
