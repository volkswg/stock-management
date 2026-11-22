'use client';

import {useEffect,useRef,useState} from 'react';
import {EditOutlined} from '@ant-design/icons';
import {Alert,Button,Checkbox,Input,Modal,Popconfirm,Select,Space,Typography} from 'antd';
import type {Product,ProductInput} from '@/modules/products/contracts';
import type {OrderItemCatalogue as Item} from '../product-catalogue-contracts';
import {
 CatalogueRequestError,itemCataloguePath,pendingCatalogueRequest,
 readItemCatalogue,retryItemCatalogue,saveItemCatalogue,searchCatalogue,
} from './catalogue-api';
import styles from './orderItemCatalogue.module.css';

const empty:ProductInput={productCode:'',productName:'',variant:''};
type View='choose'|'create'|'review';
const productLabel=(product:Product)=>[product.productCode,product.productName,product.variant].filter(Boolean).join(' · ')+(product.deletedAt?' (archived)':'');

type Props={orderId:string;itemId:string;productCode:string;onSaved:()=>Promise<void>;reloadVersion?:number};
export function OrderItemCatalogue({orderId,itemId,onSaved,reloadVersion=0}:Props){
 const [preview,setPreview]=useState<Item>();
 // Background card refreshes must never advance an open selector's revision snapshot.
 const [item,setItem]=useState<Item>();
 const [open,setOpen]=useState(false),[view,setView]=useState<View>('choose');
 const [fields,setFields]=useState<ProductInput>(empty),[selected,setSelected]=useState<Product>();
 const [products,setProducts]=useState<Product[]>([]),[useImage,setUseImage]=useState(true),[confirm,setConfirm]=useState(false);
 const [error,setError]=useState(''),[readError,setReadError]=useState('');
 const [pending,setPending]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [stale,setStale]=useState(false),[needsRefresh,setNeedsRefresh]=useState(false),[duplicateReview,setDuplicateReview]=useState(false);
 const [searching,setSearching]=useState(false);
 const saving=useRef(false),serial=useRef(0),searchSerial=useRef(0),scope=itemCataloguePath(orderId,itemId);

 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   try{
    setPending(!!pendingCatalogueRequest(scope));
    const result=await readItemCatalogue(orderId,itemId,{signal:controller.signal});
    if(!controller.signal.aborted){setPreview(result.item);setReadError('');}
   }catch(e){if(!controller.signal.aborted)setReadError(e instanceof Error?e.message:'Could not load the linked product.');}
   finally{if(!controller.signal.aborted)setLoading(false);}
  }
  void load();return()=>controller.abort();
 },[orderId,itemId,scope,reloadVersion]);

 const loadDialog=async(requested?:View)=>{
  const currentSerial=++serial.current;++searchSerial.current;setSearching(false);setBusy(true);setError('');
  try{
   const saved=pendingCatalogueRequest(scope);
   setPending(!!saved);
   const current=(await readItemCatalogue(orderId,itemId)).item;
   if(currentSerial!==serial.current)return;
   setItem(current);setPreview(current);setReadError('');
   if(saved){setView('review');return;}
   if(needsRefresh)await onSaved();
   setNeedsRefresh(false);setStale(false);setDuplicateReview(false);setConfirm(false);
   const next=requested==='create'?'create':'choose';
   setView(next);setSelected(current.product??undefined);setFields({...empty,productCode:current.productCode});
   setUseImage(!!current.imageUrl);
   if(next==='choose'){
    setProducts([]);const result=await searchCatalogue('');
    if(currentSerial===serial.current)setProducts(result.products);
   }
  }catch(e){if(currentSerial===serial.current)setError(e instanceof Error?e.message:'Could not load the product.');}
  finally{if(currentSerial===serial.current)setBusy(false);}
 };
 const launch=()=>{setOpen(true);setItem(undefined);setError('');void loadDialog();};
 const act=async(operation:()=>Promise<unknown>)=>{
  if(saving.current)return;saving.current=true;setBusy(true);setError('');
  let acknowledged=false;
  try{
   await operation();acknowledged=true;setPending(false);setNeedsRefresh(true);
   const current=(await readItemCatalogue(orderId,itemId)).item;
   setItem(current);setPreview(current);await onSaved();
   setNeedsRefresh(false);setOpen(false);
  }catch(e){
   if(acknowledged){setError('Your change was saved. Refresh the saved product before editing again.');}
   else{
    setError(e instanceof Error?e.message:'Product save failed.');
    if(e instanceof CatalogueRequestError){
     setPending(e.uncertain);if(e.uncertain)setView('review');
     if(e.code==='product_revision_conflict')setStale(true);
     if(e.code==='product_similar')setDuplicateReview(true);
    }
   }
  }finally{saving.current=false;setBusy(false);}
 };
 const search=async(query:string)=>{
  const currentSearch=++searchSerial.current,currentDialog=serial.current;
  setSearching(true);setError('');setProducts([]);
  try{const result=await searchCatalogue(query.slice(0,200));if(currentSearch===searchSerial.current&&currentDialog===serial.current)setProducts(result.products);}
  catch(e){if(currentSearch===searchSerial.current&&currentDialog===serial.current)setError(e instanceof Error?e.message:'Search failed.');}
  finally{if(currentSearch===searchSerial.current&&currentDialog===serial.current)setSearching(false);}
 };
 const choose=()=>{setView('choose');setError('');void search('');};
 const change=(key:keyof ProductInput,value:string)=>{setFields(previous=>({...previous,[key]:value}));setConfirm(false);};
 const blocked=busy||searching||pending||stale||needsRefresh;
 const available=selected?[selected,...products.filter(product=>product.id!==selected.id)]:products;
 const save=()=>{
  if(!item||blocked)return;
  if(view==='choose'&&selected&&selected.id!==item.product?.id&&!selected.deletedAt)void act(()=>saveItemCatalogue(orderId,itemId,{mode:'link',productId:selected.id,expectedRevision:item.revision}));
  else if(view==='create')void act(()=>saveItemCatalogue(orderId,itemId,{mode:'create',product:fields,useItemImage:useImage,confirmSimilar:confirm,expectedRevision:item.revision}));
 };
 let footer=<Button onClick={()=>setOpen(false)} disabled={busy}>Cancel</Button>;
 if(pending)footer=<Space><Button disabled={busy} onClick={()=>setOpen(false)}>Close</Button><Button type="primary" loading={busy} onClick={()=>void act(()=>retryItemCatalogue(orderId,itemId))}>Retry saved request</Button></Space>;
 else if(needsRefresh||stale)footer=<Space><Button disabled={busy} onClick={()=>setOpen(false)}>Close</Button><Button type="primary" loading={busy} onClick={()=>void loadDialog()}>{needsRefresh?'Refresh saved product':'Reload latest values'}</Button></Space>;
 else if(item)footer=<Space>{view==='create'?<Button disabled={busy} onClick={choose}>Choose existing product</Button>:null}<Button disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button type="primary" loading={busy} disabled={blocked||(view==='create'?!fields.productName.trim():!selected||selected.id===item.product?.id||!!selected.deletedAt)} onClick={save}>{view==='create'?'Create and link':'Save link'}</Button></Space>;

 return <>
  <div className={styles.field}>
  <Typography.Text type="secondary" className={styles.label}>Linked product</Typography.Text>
  {pending||needsRefresh?<Button size="small" onClick={launch}>{pending?'Review pending product change':'Refresh saved product'}</Button>:
   preview?.product?<div className={styles.display}>
    <Typography.Text className={styles.value}>{productLabel(preview.product)}</Typography.Text>
    <Button type="text" size="small" className={styles.edit} icon={<EditOutlined/>} onClick={launch} aria-label={'Change linked product: '+preview.product.productName} title="Change linked product"/>
   </div>:
   <Button size="small" loading={loading} disabled={loading} onClick={launch}>{readError?'Retry loading product':'Link product'}</Button>}
  </div>
  {open?<Modal title={pending?'Confirm previous product change':needsRefresh?'Refresh saved product':view==='create'?'Create product':'Select linked product'} open onCancel={()=>{if(!busy){serial.current++;setOpen(false);}}} maskClosable={!busy} footer={footer}>
   <Space orientation="vertical" size="middle" style={{width:'100%'}}>
    {error?<Alert type="error" showIcon title={error}/>:null}
    {pending?<Typography.Text>A previous save needs confirmation. Retry its saved request to check the result.</Typography.Text>:
     needsRefresh?<Typography.Text>The save is confirmed. Refreshing will read the saved result without submitting it again.</Typography.Text>:
     !item?<Button loading={busy} onClick={()=>void loadDialog()}>Load product</Button>:
     view==='choose'?<>
      <label htmlFor={'linked-product-'+itemId}>Linked product</label>
      <Select<string> id={'linked-product-'+itemId} aria-label="Select linked product" className={styles.select}
       placeholder="Search and select a product" value={selected?.id} disabled={busy||pending||stale||needsRefresh} loading={searching}
       showSearch={{filterOption:false,onSearch:query=>void search(query)}}
       options={available.map(product=>({value:product.id,label:productLabel(product),disabled:!!product.deletedAt}))}
       optionRender={option=><span className={styles.option}>{option.label}</span>}
       onChange={id=>setSelected(available.find(product=>product.id===id))}
       notFoundContent={searching?'Searching products…':'No matching products. Try another code or name.'}/>
      <Typography.Text type="secondary">Search by code or name. Only this order item’s link will change. Edit product details in <a href="/products">Product Master</a>.</Typography.Text>
      {item.product?.deletedAt?<Alert type="info" title="The linked product is archived. Select an available product or unlink it."/>:null}
      <Button disabled={blocked} onClick={()=>{setFields({...empty,productCode:item.productCode});setView('create');setError('');setConfirm(false);setDuplicateReview(false);}}>Create new product</Button>
      {item.product?<Popconfirm title="Unlink this product?" description="The catalogue product and original order data will be kept." disabled={blocked} onConfirm={()=>act(()=>saveItemCatalogue(orderId,itemId,{mode:'link',productId:null,expectedRevision:item.revision}))}><Button disabled={blocked}>Unlink product</Button></Popconfirm>:null}
     </>:<>
      <label>Product name<Input aria-label="Product name" value={fields.productName} maxLength={200} disabled={blocked} onChange={e=>change('productName',e.target.value)}/></label>
      <label>Product code<Input aria-label="Product code" value={fields.productCode} maxLength={100} disabled={blocked} onChange={e=>change('productCode',e.target.value)}/></label>
      <label>Variant<Input aria-label="Product variant" value={fields.variant} maxLength={100} disabled={blocked} onChange={e=>change('variant',e.target.value)}/></label>
      <Checkbox checked={useImage} disabled={blocked||!item.imageUrl} onChange={e=>setUseImage(e.target.checked)}>Use this item’s existing photo</Checkbox>
      <details open={duplicateReview||undefined}><summary>Duplicate handling</summary><Checkbox checked={confirm} disabled={blocked} onChange={e=>setConfirm(e.target.checked)}>I reviewed matching products and want a separate product</Checkbox></details>
     </>}
   </Space>
  </Modal>:null}
 </>;
}
