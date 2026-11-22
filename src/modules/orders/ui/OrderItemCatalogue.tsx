'use client';
import {useRef,useState} from 'react';
import {Alert,Button,Checkbox,Input,Modal,Popconfirm,Space,Typography} from 'antd';
import type {Product,ProductInput} from '@/modules/products/contracts';
import type {OrderItemCatalogue as Item} from '../product-catalogue-contracts';
import {archiveCatalogueProduct,CatalogueRequestError,itemCataloguePath,pendingCatalogueRequest,readItemCatalogue,retryItemCatalogue,saveItemCatalogue,searchCatalogue,updateCatalogueProduct} from './catalogue-api';
const empty:ProductInput={productCode:'',productName:'',variant:''};
export function OrderItemCatalogue({orderId,itemId,productCode,onSaved}:{orderId:string;itemId:string;productCode:string;onSaved:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[item,setItem]=useState<Item>(),[fields,setFields]=useState<ProductInput>(empty),[query,setQuery]=useState(productCode),[products,setProducts]=useState<Product[]>([]),[useImage,setUseImage]=useState(true),[confirm,setConfirm]=useState(false),[editing,setEditing]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(false),[busy,setBusy]=useState(false);
 const scope=itemCataloguePath(orderId,itemId);
 const saving=useRef(false),loadSerial=useRef(0);
 const change=(key:keyof ProductInput,value:string)=>{setFields(previous=>({...previous,[key]:value}));setConfirm(false);};
 const refresh=async()=>{const result=await readItemCatalogue(orderId,itemId);setItem(result.item);return result.item;};
 const launch=async()=>{
  setOpen(true);setError('');setNotice('');setEditing(false);setPending(false);setBusy(true);const serial=++loadSerial.current;
  try{
   const saved=pendingCatalogueRequest(itemCataloguePath(orderId,itemId));setPending(!!saved);
   if(saved){const body=JSON.parse(saved.body);if(saved.method==='POST'&&body.mode==='create'){setFields(body.product);setUseImage(body.useItemImage);setConfirm(body.confirmSimilar);}setError(`Previous product operation needs confirmation. Reference: ${saved.key}`);}
   else {setFields({...empty,productCode});setConfirm(false);setUseImage(true);}
   const current=await readItemCatalogue(orderId,itemId);if(serial!==loadSerial.current)return;setItem(current.item);if(!saved)setUseImage(!!current.item.imageUrl);
   const found=await searchCatalogue(productCode);if(serial===loadSerial.current)setProducts(found.products);
  }catch(e){setError(e instanceof Error?e.message:'Could not load the catalogue.');}finally{if(serial===loadSerial.current)setBusy(false);}
 };
 const act=async(operation:()=>Promise<unknown>,message:string)=>{
  if(saving.current)return;saving.current=true;setBusy(true);setError('');setNotice('');
  try{await operation();setPending(false);await onSaved();await refresh();setNotice(message);setEditing(false);}
  catch(e){setError(e instanceof Error?e.message:'Product save failed.');setPending(e instanceof CatalogueRequestError&&e.uncertain);if(e instanceof CatalogueRequestError&&e.code==='product_revision_conflict')await refresh().catch(()=>{});}
  finally{saving.current=false;setBusy(false);}
 };
 const search=async()=>{setBusy(true);setError('');try{setProducts((await searchCatalogue(query)).products);}catch(e){setError(e instanceof Error?e.message:'Search failed.');}finally{setBusy(false);}};
 return <>
  <Button size="small" onClick={()=>void launch()}>Product catalogue</Button>
  <Modal title="Product from this order item" open={open} onCancel={()=>{if(!busy){loadSerial.current++;setOpen(false);}}} footer={null} maskClosable={!busy} destroyOnHidden>
   <Space orientation="vertical" style={{width:'100%'}} size="middle">
    {error?<Alert type="error" showIcon title={error}/>:null}
    {notice?<Alert type="success" showIcon title={notice}/>:null}
    {pending?<Button loading={busy} onClick={()=>void act(()=>retryItemCatalogue(orderId,itemId),'Saved product operation confirmed.')}>Retry saved request</Button>:null}
    <Button disabled={busy||pending} onClick={()=>void refresh().catch(e=>setError(e instanceof Error?e.message:'Refresh failed.'))}>Refresh saved item</Button>
    {item?.product?<Space orientation="vertical"><Typography.Text>Linked: {item.product.productCode} · {item.product.productName} {item.product.variant}{item.product.deletedAt?' (archived)':''}</Typography.Text>
      <Space wrap><Button disabled={busy||pending} onClick={()=>item&&void act(()=>saveItemCatalogue(orderId,itemId,{mode:'link',productId:null,expectedRevision:item.revision}),'Product unlinked. Original order data is unchanged.')}>Unlink</Button>
      <Button disabled={busy||pending||!!item.product.deletedAt} onClick={()=>{if(item.product){setFields(item.product);setEditing(true);}}}>Edit catalogue product</Button>
      <Popconfirm title="Archive this catalogue product?" description="It will be unavailable for new links. Historical links remain." disabled={busy||pending||!!item.product.deletedAt} onConfirm={()=>item.product&&act(()=>archiveCatalogueProduct(item.product!,scope),'Product archived. Historical links are retained.')}><Button danger disabled={busy||pending||!!item.product.deletedAt}>Archive product</Button></Popconfirm></Space></Space>:null}
    <Typography.Text strong>Choose an existing product</Typography.Text>
    <Space.Compact style={{width:'100%'}}><Input aria-label="Search catalogue" value={query} disabled={busy||pending} onChange={e=>setQuery(e.target.value)} onPressEnter={()=>void search()}/><Button disabled={busy||pending} onClick={()=>void search()}>Search</Button></Space.Compact>
    {products.map(product=><Space key={product.id} wrap><Typography.Text>{product.productCode} · {product.productName} {product.variant}</Typography.Text><Button size="small" disabled={busy||pending||!item} onClick={()=>item&&void act(()=>saveItemCatalogue(orderId,itemId,{mode:'link',productId:product.id,expectedRevision:item.revision}),'Existing product linked.')}>Use this product</Button></Space>)}
    <Typography.Text strong>{editing?'Edit the linked catalogue product':'Or create a new product'}</Typography.Text>
    <label>Product code<Input aria-label="Catalogue product code" value={fields.productCode} maxLength={100} disabled={busy||pending} onChange={e=>change('productCode',e.target.value)}/></label>
    <label>Product name<Input aria-label="Catalogue product name" value={fields.productName} maxLength={200} disabled={busy||pending} onChange={e=>change('productName',e.target.value)}/></label>
    <label>Variant<Input aria-label="Catalogue product variant" value={fields.variant} maxLength={100} disabled={busy||pending} onChange={e=>change('variant',e.target.value)}/></label>
    {!editing?<><Checkbox checked={useImage} disabled={busy||pending||!item?.imageUrl} onChange={e=>setUseImage(e.target.checked)}>Reuse this item’s existing photo as reference</Checkbox>
    <Checkbox checked={confirm} disabled={busy||pending} onChange={e=>setConfirm(e.target.checked)}>I reviewed similar products and intentionally want a new product</Checkbox></>:null}
    <Button type="primary" loading={busy} disabled={!item||pending||!fields.productName.trim()} onClick={()=>item&&void act(()=>editing&&item.product?updateCatalogueProduct(item.product,fields,scope):saveItemCatalogue(orderId,itemId,{mode:'create',product:fields,useItemImage:useImage,confirmSimilar:confirm,expectedRevision:item.revision}),editing?'Catalogue product updated.':'Product created and linked.')}>{editing?'Save catalogue product':'Confirm create and link'}</Button>
    <Typography.Text type="secondary">Existing quantities, remarks, codes and uploaded photos are preserved. Catalogue names are shared across linked orders.</Typography.Text>
   </Space>
  </Modal>
 </>;
}
