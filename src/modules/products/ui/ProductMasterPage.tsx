'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeftOutlined,ReloadOutlined} from '@ant-design/icons';
import {Alert,Button,Card,ConfigProvider,Empty,Image,Input,Modal,Popconfirm,Space,Table,Typography} from 'antd';
import type {Product,ProductInput} from '../contracts';
import {archiveCatalogueProduct,CatalogueRequestError,pendingCatalogueRequest,readCatalogueProduct,retryCatalogueRequest,searchCatalogue,updateCatalogueProduct} from '../browser';
import styles from './productMaster.module.css';

const scope='product-master';
const empty:ProductInput={productCode:'',productName:'',variant:''};
const fieldsOf=(product:Product):ProductInput=>({productCode:product.productCode,productName:product.productName,variant:product.variant});
export function ProductMasterPage(){
 const [products,setProducts]=useState<Product[]>([]),[query,setQuery]=useState(''),[filter,setFilter]=useState('');
 const [loading,setLoading]=useState(true),[listError,setListError]=useState('');
 const [open,setOpen]=useState(false),[product,setProduct]=useState<Product>(),[fields,setFields]=useState<ProductInput>(empty);
 const [pending,setPending]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [stale,setStale]=useState(false),[needsRefresh,setNeedsRefresh]=useState(false);
 const sequence=useRef(0),saving=useRef(false),dialogId=useRef<string>(undefined);
 useEffect(()=>{
  const controller=new AbortController(),current=++sequence.current;
  async function load(){
   try{setPending(!!pendingCatalogueRequest(scope));const result=await searchCatalogue('',{signal:controller.signal});if(!controller.signal.aborted&&current===sequence.current)setProducts(result.products);}
   catch(e){if(!controller.signal.aborted&&current===sequence.current)setListError(e instanceof Error?e.message:'Could not load products.');}
   finally{if(!controller.signal.aborted&&current===sequence.current)setLoading(false);}
  }
  void load();return()=>controller.abort();
 },[]);
 const reloadList=async(search=filter)=>{
  const current=++sequence.current;setLoading(true);setListError('');
  try{const result=await searchCatalogue(search);if(current===sequence.current){setProducts(result.products);setFilter(search);}}
  catch(e){if(current===sequence.current)setListError(e instanceof Error?e.message:'Could not load products.');}
  finally{if(current===sequence.current)setLoading(false);}
 };
 const loadProduct=async(id:string)=>{
  dialogId.current=id;setBusy(true);setError('');
  try{
   const saved=pendingCatalogueRequest(scope);setPending(!!saved);
   const target=saved?saved.path.split('/').pop()!:id;
   dialogId.current=target;const result=await readCatalogueProduct(target);if(result.product.id!==target)throw new Error('Could not confirm the selected product.');
   setProduct(result.product);setFields(fieldsOf(result.product));setStale(false);setNeedsRefresh(false);
  }catch(e){setError(e instanceof Error?e.message:'Could not load the product.');}
  finally{setBusy(false);}
 };
 const edit=(selected:Product)=>{setOpen(true);setProduct(undefined);setError('');setNotice('');setStale(false);void loadProduct(selected.id);};
 const review=()=>{
  setOpen(true);setProduct(undefined);setError('');
  try{const saved=pendingCatalogueRequest(scope);if(saved)void loadProduct(saved.path.split('/').pop()!);else{setPending(false);setOpen(false);}}
  catch(e){setError(e instanceof Error?e.message:'The pending request needs review.');}
 };
 const act=async(operation:()=>Promise<{product:Product}>)=>{
  if(saving.current)return;saving.current=true;setBusy(true);setError('');
  let acknowledged=false;
  try{
   const result=await operation();acknowledged=true;setPending(false);setNeedsRefresh(true);setProduct(result.product);
   // A failed list refresh cannot turn an acknowledged save into another write.
   const latest=await searchCatalogue(filter);setProducts(latest.products);setListError('');
   setNeedsRefresh(false);setOpen(false);setNotice(result.product.deletedAt?'Product archived. Existing links are kept.':'Product saved.');
  }catch(e){
   if(acknowledged)setError('Your change was saved. Refresh the list before editing again.');
   else{setError(e instanceof Error?e.message:'Product save failed.');if(e instanceof CatalogueRequestError){setPending(e.uncertain);if(e.code==='product_revision_conflict')setStale(true);}}
  }finally{saving.current=false;setBusy(false);}
 };
 const refreshSaved=async()=>{setBusy(true);setError('');try{const result=await searchCatalogue(filter);setProducts(result.products);setNeedsRefresh(false);setOpen(false);setNotice('Saved product confirmed.');}catch(e){setError(e instanceof Error?e.message:'Could not refresh the saved result.');}finally{setBusy(false);}};
 const blocked=busy||pending||stale||needsRefresh;
 const footer=pending?<Space><Button disabled={busy} onClick={()=>setOpen(false)}>Close</Button><Button type="primary" loading={busy} onClick={()=>void act(()=>retryCatalogueRequest<{product:Product}>(scope))}>Retry saved request</Button></Space>:
  needsRefresh?<Space><Button disabled={busy} onClick={()=>setOpen(false)}>Close</Button><Button type="primary" loading={busy} onClick={()=>void refreshSaved()}>Refresh saved result</Button></Space>:
  stale?<Space><Button disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button><Button type="primary" loading={busy} onClick={()=>dialogId.current&&void loadProduct(dialogId.current)}>Reload latest values</Button></Space>:
  <Space><Button disabled={busy} onClick={()=>setOpen(false)}>Cancel</Button>{product&&!product.deletedAt?<Button type="primary" loading={busy} disabled={blocked||!fields.productName.trim()} onClick={()=>void act(()=>updateCatalogueProduct(product,fields,scope))}>Save product</Button>:null}</Space>;
 return <ConfigProvider theme={{token:{colorPrimary:'#157347',colorBgLayout:'#f3f5f4',borderRadius:6}}}>
  <div className={styles.shell}><main className={styles.page}>
   <Link href="/"><ArrowLeftOutlined/> Workspace</Link>
   <div className={styles.header}><div><span className={styles.eyebrow}>Stock</span><h1>Product Master</h1><p>Search and manage your product catalogue.</p></div><Button href="/orders">Create from an order item</Button></div>
   <Space orientation="vertical" size="middle" style={{width:'100%'}}>
    {pending?<Alert type="warning" showIcon title="A previous product change needs confirmation" action={<Button onClick={review}>Review saved change</Button>}/>:null}
    {needsRefresh&&!open?<Alert type="info" title="Your change was saved. Refresh the list before editing again." action={<Button onClick={()=>void refreshSaved()}>Refresh saved result</Button>}/>:null}
    {notice?<Alert type="success" showIcon title={notice} closable onClose={()=>setNotice('')}/>:null}
    {listError?<Alert type="error" showIcon title={listError} action={<Button onClick={()=>void reloadList()}>Retry</Button>}/>:null}
    <Card>
     <div className={styles.toolbar}><Input.Search className={styles.search} aria-label="Search products" placeholder="Search by product code or name" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)} onSearch={()=>void reloadList(query.trim())} enterButton="Search"/><Button icon={<ReloadOutlined/>} loading={loading} onClick={()=>void reloadList()}>Refresh</Button></div>
     <Table<Product> rowKey="id" loading={loading} dataSource={products} scroll={{x:650}} pagination={{pageSize:10,hideOnSinglePage:true}} locale={{emptyText:<Empty description="No matching products. Create a product from an order item."/>}} columns={[
      {title:'Photo',key:'photo',width:72,render:(_,row)=>row.imageUrl?<Image width={48} height={48} style={{objectFit:'cover'}} src={row.imageUrl} alt={row.productName}/>:<Typography.Text type="secondary">—</Typography.Text>},
      {title:'Product name',dataIndex:'productName',render:(_,row)=><Button type="link" style={{paddingInline:0,height:'auto',maxWidth:360,whiteSpace:'normal',wordBreak:'break-word',textAlign:'left'}} disabled={pending||needsRefresh} onClick={()=>edit(row)}>{row.productName}</Button>},
      {title:'Code',dataIndex:'productCode',render:value=>value||'—'},
      {title:'Variant',dataIndex:'variant',render:value=>value||'—'},
      {title:'Actions',key:'actions',width:80,render:(_,row)=><Button size="small" disabled={pending||needsRefresh} onClick={()=>edit(row)} aria-label={'Edit product: '+row.productName}>Edit</Button>},
     ]}/>
     <Typography.Text type="secondary">Showing up to 30 matching products. Search to narrow the list.</Typography.Text>
    </Card>
   </Space>
  </main></div>
  {open?<Modal title={pending?'Confirm previous product change':'Edit product'} open footer={footer} onCancel={()=>{if(!busy)setOpen(false);}} maskClosable={!busy}>
   <Space orientation="vertical" size="middle" className={styles.fields}>
    {error?<Alert type="error" showIcon title={error}/>:null}
    {pending?<Typography.Text>Retry the saved request to confirm its result. No new operation will be created.</Typography.Text>:
     needsRefresh?<Typography.Text>The save is confirmed. Refreshing will only read the saved result.</Typography.Text>:
     !product?<Button loading={busy} onClick={()=>dialogId.current&&void loadProduct(dialogId.current)}>{busy?'Loading product…':'Retry loading product'}</Button>:<>
      {product.deletedAt?<Alert type="info" title="This product is archived. Existing links remain available."/>:null}
      <label>Product name<Input aria-label="Product name" value={fields.productName} maxLength={200} disabled={blocked||!!product.deletedAt} onChange={e=>setFields(previous=>({...previous,productName:e.target.value}))}/></label>
      <label>Product code<Input aria-label="Product code" value={fields.productCode} maxLength={100} disabled={blocked||!!product.deletedAt} onChange={e=>setFields(previous=>({...previous,productCode:e.target.value}))}/></label>
      <label>Variant<Input aria-label="Product variant" value={fields.variant} maxLength={100} disabled={blocked||!!product.deletedAt} onChange={e=>setFields(previous=>({...previous,variant:e.target.value}))}/></label>
      <Typography.Text type="secondary">Changes update this catalogue product wherever it is linked.</Typography.Text>
      {!product.deletedAt?<details><summary>More options</summary><Popconfirm title="Archive this product?" description="It will be unavailable for new links. Existing links and photos are kept." disabled={blocked} onConfirm={()=>act(()=>archiveCatalogueProduct(product,scope))}><Button danger disabled={blocked}>Archive product</Button></Popconfirm></details>:null}
     </>}
   </Space>
  </Modal>:null}
 </ConfigProvider>;
}
