'use client';

import {useEffect,useRef,useState} from 'react';
import {EditOutlined} from '@ant-design/icons';
import {Alert,Button,Checkbox,Input,Modal,Popconfirm,Space,Typography} from 'antd';
import type {Product,ProductInput} from '@/modules/products/contracts';
import type {OrderItemCatalogue as Item} from '../product-catalogue-contracts';
import {
 archiveCatalogueProduct,CatalogueRequestError,itemCataloguePath,pendingCatalogueRequest,
 readItemCatalogue,retryItemCatalogue,saveItemCatalogue,searchCatalogue,updateCatalogueProduct,
} from './catalogue-api';

const empty:ProductInput={productCode:'',productName:'',variant:''};
type View='choose'|'create'|'edit'|'review';
const productFields=(product:Product):ProductInput=>({productCode:product.productCode,productName:product.productName,variant:product.variant});
const productLabel=(product:Product)=>[product.productCode,product.productName,product.variant].filter(Boolean).join(' · ')+(product.deletedAt?' (archived)':'');

type Props={orderId:string;itemId:string;productCode:string;onSaved:()=>Promise<void>;reloadVersion?:number};
export function OrderItemCatalogue({orderId,itemId,productCode,onSaved,reloadVersion=0}:Props){
 const [preview,setPreview]=useState<Item>();
 // Background card refreshes must never advance an open editor's revision snapshot.
 const [item,setItem]=useState<Item>();
 const [open,setOpen]=useState(false),[view,setView]=useState<View>('choose');
 const [fields,setFields]=useState<ProductInput>(empty),[query,setQuery]=useState(productCode);
 const [products,setProducts]=useState<Product[]>([]),[useImage,setUseImage]=useState(true),[confirm,setConfirm]=useState(false);
 const [error,setError]=useState(''),[readError,setReadError]=useState('');
 const [pending,setPending]=useState(false),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [stale,setStale]=useState(false),[needsRefresh,setNeedsRefresh]=useState(false),[duplicateReview,setDuplicateReview]=useState(false);
 const saving=useRef(false),serial=useRef(0),scope=itemCataloguePath(orderId,itemId);

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
  const currentSerial=++serial.current;setBusy(true);setError('');
  try{
   const saved=pendingCatalogueRequest(scope);
   setPending(!!saved);
   const current=(await readItemCatalogue(orderId,itemId)).item;
   if(currentSerial!==serial.current)return;
   setItem(current);setPreview(current);setReadError('');
   if(saved){setView('review');return;}
   if(needsRefresh)await onSaved();
   setNeedsRefresh(false);setStale(false);setDuplicateReview(false);setConfirm(false);
   const next=requested==='create'?'create':requested==='choose'?'choose':current.product?'edit':'choose';
   setView(next);setFields(next==='edit'&&current.product?productFields(current.product):{...empty,productCode:current.productCode});
   setUseImage(!!current.imageUrl);
   if(next==='choose'){
    const search=current.productCode||current.product?.productCode||'';
    setQuery(search);const result=await searchCatalogue(search);
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
 const choose=async()=>{
  setView('choose');setError('');setBusy(true);
  try{const result=await searchCatalogue(query);setProducts(result.products);}
  catch(e){setError(e instanceof Error?e.message:'Search failed.');}
  finally{setBusy(false);}
 };
 const search=async()=>{setBusy(true);setError('');try{setProducts((await searchCatalogue(query)).products);}catch(e){setError(e instanceof Error?e.message:'Search failed.');}finally{setBusy(false);}};
 const change=(key:keyof ProductInput,value:string)=>{setFields(previous=>({...previous,[key]:value}));setConfirm(false);};
 const blocked=busy||pending||stale||needsRefresh;
 const editing=view==='edit',archived=editing&&!!item?.product?.deletedAt;
 const save=()=>{
  if(!item||blocked)return;
  if(editing&&item.product)void act(()=>updateCatalogueProduct(item.product!,fields,scope));
  else if(view==='create')void act(()=>saveItemCatalogue(orderId,itemId,{mode:'create',product:fields,useItemImage:useImage,confirmSimilar:confirm,expectedRevision:item.revision}));
 };
 let footer=<Button onClick={()=>setOpen(false)} disabled={busy}>Cancel</Button>;
 if(pending)footer=<Space><Button disabled={busy} onClick={()=>setOpen(false)}>Close</Button><Button type="primary" loading={busy} onClick={()=>void act(()=>retryItemCatalogue(orderId,itemId))}>Retry saved request</Button></Space>;
 else if(needsRefresh||stale)footer=<Space><Button disabled={busy} onClick={()=>setOpen(false)}>Close</Button><Button type="primary" loading={busy} onClick={()=>void loadDialog()}>{needsRefresh?'Refresh saved product':'Reload latest values'}</Button></Space>;
 else if(item&&(view==='create'||editing&&!archived))footer=<Space>{view==='create'?<Button disabled={busy} onClick={()=>void choose()}>Choose existing product</Button>:null}<Button disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button type="primary" loading={busy} disabled={blocked||!fields.productName.trim()} onClick={save}>{editing?'Save product':'Create and link'}</Button></Space>;

 return <>
  {pending||needsRefresh?<Button size="small" onClick={launch}>{pending?'Review pending product change':'Refresh saved product'}</Button>:
   preview?.product?<Button type="link" size="small" icon={<EditOutlined/>} onClick={launch} aria-label={'Edit product: '+preview.product.productName} style={{paddingInline:0,height:'auto',whiteSpace:'normal',textAlign:'left'}}>{productLabel(preview.product)}</Button>:
   <Button size="small" loading={loading} disabled={loading} onClick={launch}>{readError?'Retry loading product':'Link product'}</Button>}
  {open?<Modal title={pending?'Confirm previous product change':needsRefresh?'Refresh saved product':editing?'Edit product':view==='create'?'Create product':'Link product'} open onCancel={()=>{if(!busy){serial.current++;setOpen(false);}}} maskClosable={!busy} footer={footer}>
   <Space orientation="vertical" size="middle" style={{width:'100%'}}>
    {error?<Alert type="error" showIcon title={error}/>:null}
    {pending?<Typography.Text>A previous save needs confirmation. Retry its saved request to check the result.</Typography.Text>:
     needsRefresh?<Typography.Text>The save is confirmed. Refreshing will read the saved result without submitting it again.</Typography.Text>:
     !item?<Button loading={busy} onClick={()=>void loadDialog()}>Load product</Button>:
     view==='choose'?<>
      <Input.Search aria-label="Search products" placeholder="Search by code or name" value={query} disabled={blocked} onChange={e=>setQuery(e.target.value)} onSearch={()=>void search()} enterButton="Search"/>
      {products.length?products.map(product=><Space key={product.id} style={{width:'100%',justifyContent:'space-between'}}><Typography.Text>{productLabel(product)}</Typography.Text>{product.id===item.product?.id?<Typography.Text type="secondary">Linked</Typography.Text>:<Button disabled={blocked} onClick={()=>void act(()=>saveItemCatalogue(orderId,itemId,{mode:'link',productId:product.id,expectedRevision:item.revision}))}>Use this product</Button>}</Space>):<Typography.Text type="secondary">No matching products.</Typography.Text>}
      <Button type="primary" disabled={blocked} onClick={()=>{setFields({...empty,productCode:item.productCode});setView('create');setError('');setConfirm(false);setDuplicateReview(false);}}>Create new product</Button>
      {item.product?<Button type="link" disabled={blocked} onClick={()=>{setFields(productFields(item.product!));setView('edit');setError('');}}>Back to linked product</Button>:null}
     </>:<>
      {archived?<Alert type="info" title="This product is archived. You can change or remove this item’s link."/>:null}
      <label>Product name<Input aria-label="Product name" value={fields.productName} maxLength={200} disabled={blocked||archived} onChange={e=>change('productName',e.target.value)}/></label>
      <label>Product code<Input aria-label="Product code" value={fields.productCode} maxLength={100} disabled={blocked||archived} onChange={e=>change('productCode',e.target.value)}/></label>
      <label>Variant<Input aria-label="Product variant" value={fields.variant} maxLength={100} disabled={blocked||archived} onChange={e=>change('variant',e.target.value)}/></label>
      {view==='create'?<>
       <Checkbox checked={useImage} disabled={blocked||!item.imageUrl} onChange={e=>setUseImage(e.target.checked)}>Use this item’s existing photo</Checkbox>
       <details open={duplicateReview||undefined}><summary>Duplicate handling</summary><Checkbox checked={confirm} disabled={blocked} onChange={e=>setConfirm(e.target.checked)}>I reviewed matching products and want a separate product</Checkbox></details>
      </>:item.product?<>
       <Typography.Text type="secondary">Changes update this catalogue product wherever it is linked.</Typography.Text>
       <details><summary>More options</summary><Space orientation="vertical" align="start">
        <Button type="link" disabled={blocked} onClick={()=>void choose()}>Change linked product</Button>
        <Popconfirm title="Unlink this product?" description="The catalogue product and original order data will be kept." disabled={blocked} onConfirm={()=>act(()=>saveItemCatalogue(orderId,itemId,{mode:'link',productId:null,expectedRevision:item.revision}))}><Button disabled={blocked}>Unlink product</Button></Popconfirm>
        {!archived?<Popconfirm title="Archive this catalogue product?" description="It will be unavailable for new links. Existing links remain." disabled={blocked} onConfirm={()=>act(()=>archiveCatalogueProduct(item.product!,scope))}><Button danger disabled={blocked}>Archive product</Button></Popconfirm>:null}
       </Space></details>
      </>:null}
     </>}
   </Space>
  </Modal>:null}
 </>;
}
