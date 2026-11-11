"""Bounded JSONB reads preserving PostgreSQL 17's complete text representation."""
import json,re
from core import quote
from contextlib import contextmanager
import subprocess,threading,struct
from pg_access import client_environment

ARRAY_CHUNK=2048
STRING_CHUNK=1048576

def jsonpath(path):
    return 'strict $'+''.join('['+str(k)+']' if isinstance(k,int) else '.'+json.dumps(k,ensure_ascii=False) for k in path)

def path_sql(path):return 'ARRAY['+','.join(quote(str(k)) for k in path)+']::text[]'

def scalar(session,expression,source):
    rows=session.rows('SELECT '+expression+' FROM '+source+';')
    if len(rows)!=1:raise ValueError('missing or duplicate JSONB source')
    # Only JSON-encoded results are used, so physical output newlines are escaped.
    return json.loads(rows[0])

def jsonb_fragments(session,expression,source,path=(),known_kind=None):
    jpath=jsonpath(path)
    kind=known_kind or scalar(session,'jsonb_path_query_first('+expression+','+quote(jpath+'.type()')+')::text',source)
    if kind=='object':
        # Native key enumeration avoids materializing keyvalue() objects that
        # copy each large child even when only its name is requested.
        node=expression if not path else expression+' #> '+path_sql(path)
        keys=scalar(session,"coalesce((SELECT json_agg(k ORDER BY octet_length(k),k COLLATE \"C\") FROM jsonb_object_keys("+node+") AS k),'[]'::json)::text",source)
        if not isinstance(keys,list) or not all(isinstance(k,str) for k in keys) or keys!=sorted(set(keys),key=lambda k:(len(k.encode('utf8')),k.encode('utf8'))):raise ValueError('invalid JSONB object keys')
        yield '{'
        for i,key in enumerate(keys):
            if i:yield ', '
            yield json.dumps(key,ensure_ascii=False)+': '
            yield from jsonb_fragments(session,expression,source,path+(key,))
        yield '}'
    elif kind=='array':
        size=scalar(session,'jsonb_path_query_first('+expression+','+quote(jpath+'.size()')+')::text',source)
        if not isinstance(size,int) or size<0:raise ValueError('invalid JSONB array length')
        yield '['
        for start in range(0,size,ARRAY_CHUNK):
            end=min(size,start+ARRAY_CHUNK)-1
            rows=session.rows('SELECT jsonb_path_query_array('+expression+','+quote(jpath+f'[{start} to {end}]')+')::text FROM '+source+';')
            if len(rows)!=1:raise ValueError('invalid JSONB array partition')
            raw=rows[0].decode('utf8').removesuffix('\n')
            # Verify the transport partition contains every expected array item.
            # parse_float=str avoids unnecessary decimal arithmetic; we hash the
            # unchanged PostgreSQL text rather than serializing parsed values.
            if not raw.startswith('[') or not raw.endswith(']') or len(json.loads(raw,parse_float=str))!=end-start+1:raise ValueError('incomplete JSONB array partition')
            if start:yield ', '
            yield raw[1:-1]
        yield ']'
    elif kind=='string':
        value=expression+' #>> '+path_sql(path)
        size=scalar(session,'to_jsonb(length('+value+'))::text',source)
        if not isinstance(size,int) or size<0:raise ValueError('invalid JSONB string length')
        yield '"'
        for start in range(0,size,STRING_CHUNK):
            piece=scalar(session,'to_jsonb(substring('+value+' FROM '+str(start+1)+' FOR '+str(STRING_CHUNK)+'))::text',source)
            if not isinstance(piece,str) or len(piece)!=min(STRING_CHUNK,size-start):raise ValueError('incomplete JSONB string partition')
            yield json.dumps(piece,ensure_ascii=False)[1:-1]
        yield '"'
    elif kind in ('number','boolean','null'):
        rows=session.rows('SELECT jsonb_path_query_first('+expression+','+quote(jpath)+')::text FROM '+source+';')
        if len(rows)!=1:raise ValueError('missing JSONB scalar')
        yield rows[0].decode('utf8').removesuffix('\n')
    else:raise ValueError('unsupported JSONB node')

import hashlib,tempfile

def quoted(text):return json.dumps(text,ensure_ascii=False)

def batch_fingerprint(session):
    columns=json.loads(b''.join(session.rows("SELECT json_agg(attname ORDER BY attname) FROM pg_attribute WHERE attrelid='stock_migration.import_batches'::regclass AND attnum>0 AND NOT attisdropped;")))
    if columns!=['checksum','imported_at','snapshot','workbook']:raise ValueError('unexpected recovery batch columns')
    records=[json.loads(line) for line in session.rows("SELECT jsonb_build_object('checksum',checksum,'workbook',workbook,'imported_at',imported_at) FROM stock_migration.import_batches ORDER BY checksum COLLATE \"C\";")]
    result=hashlib.sha256()
    for record in records:
        # checksum is the first JSONB row key, a fixed-length non-null primary
        # key; sorting it in C order is exactly the previous whole-row order.
        if not re.fullmatch('[0-9a-f]{64}',record['checksum']):raise ValueError('unexpected batch identity')
        with tempfile.TemporaryFile() as spool:
            characters=0
            def write(text):
                nonlocal characters
                spool.write(text.encode('utf8'));characters+=len(text)
            write('{"checksum": '+quoted(record['checksum'])+', "snapshot": ')
            source='(SELECT snapshot FROM stock_migration.import_batches WHERE checksum='+quote(record['checksum'])+') AS batch'
            for part in jsonb_fragments(session,'batch.snapshot',source):write(part)
            write(', "workbook": '+quoted(record['workbook'])+', "imported_at": '+quoted(record['imported_at'])+'}')
            result.update(str(characters).encode('ascii')+b':');spool.seek(0)
            for block in iter(lambda:spool.read(65536),b''):result.update(block)
    return {'table':'stock_migration.import_batches','rows':len(records),'sha256':result.hexdigest()}


class ReadSession:
    def __init__(self,process):self.process=process
    def send(self,sql):
        self.process.stdin.write((sql+'\n\\echo private-query-end\n').encode('utf8'));self.process.stdin.flush()
    def rows(self,sql):
        self.send(sql);lines=[]
        for line in self.process.stdout:
            if line==b'private-query-end\n':return lines
            lines.append(line)
        raise ValueError('private read-only query failed')

    def digest_table_fingerprint(self, table):
        # Hash every canonical full row on the server, then stream the sorted
        # fixed-size hashes. Duplicates remain repeated; no field is omitted.
        lines=self.rows(f"COPY (WITH hashes AS MATERIALIZED (SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AS h FROM {table} t) SELECT h FROM hashes ORDER BY h COLLATE \"C\") TO STDOUT;")
        result=hashlib.sha256(b'stock-table-row-sha256-v2\x00');count=0;previous=b''
        for line in lines:
            if not re.fullmatch(b'[0-9a-f]{64}\n',line): raise ValueError('invalid row fingerprint stream')
            value=line[:-1]
            if value<previous: raise ValueError('unsorted row fingerprint stream')
            result.update(bytes.fromhex(value.decode('ascii')));previous=value;count+=1
        return {'table':table,'rows':count,'sha256':result.hexdigest(),'algorithm':'sorted-row-sha256-v2'}

    def table_fingerprint(self, table):
        self.send(f'COPY (WITH serialized AS MATERIALIZED (SELECT to_jsonb(t)::text AS v FROM {table} t) SELECT length(v),v FROM serialized ORDER BY v COLLATE "C") TO STDOUT (FORMAT binary);')
        stream=self.process.stdout
        if read_exact(stream,19)!=b'PGCOPY\n\xff\r\n\x00'+struct.pack('!ii',0,0):raise ValueError('invalid table fingerprint header')
        result=hashlib.sha256();count=0
        while True:
            fields=struct.unpack('!h',read_exact(stream,2))[0]
            if fields==-1:break
            if fields!=2 or struct.unpack('!i',read_exact(stream,4))[0]!=4:raise ValueError('invalid table fingerprint fields')
            characters=struct.unpack('!i',read_exact(stream,4))[0]
            size=struct.unpack('!i',read_exact(stream,4))[0]
            if characters<0 or size<characters:raise ValueError('invalid table fingerprint length')
            result.update(str(characters).encode('ascii')+b':')
            while size:
                block=read_exact(stream,min(65536,size));result.update(block);size-=len(block)
            count+=1
        if stream.readline()!=b'private-query-end\n':raise ValueError('incomplete table fingerprint')
        return {'table':table,'rows':count,'sha256':result.hexdigest()}


def read_exact(stream,size):
    blocks=[]
    while size:
        block=stream.read(size)
        if not block:raise ValueError('incomplete table fingerprint stream')
        blocks.append(block);size-=len(block)
    return b''.join(blocks)

@contextmanager
def read_session(begin, timeout=150):
    if timeout<=0:raise ValueError('private read-only deadline exceeded')
    process=subprocess.Popen(['psql','-XqAtw','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=client_environment())
    timer=threading.Timer(min(150,timeout),process.kill);timer.start()
    try:
        session=ReadSession(process);session.rows(begin)
        yield session
        session.rows('COMMIT;');process.stdin.write(b'\\q\n');process.stdin.flush();process.stdin.close()
        if process.wait():raise ValueError('private read-only query failed')
    finally:
        timer.cancel()
        if process.poll() is None:process.kill()
        process.wait();process.stdout.close()
        if not process.stdin.closed:process.stdin.close()


def jsonb_equal(left, right):
    """JSONB equality: exact numbers ignore scale, while booleans stay distinct."""
    from decimal import Decimal
    if isinstance(left,dict):
        return isinstance(right,dict) and left.keys()==right.keys() and all(jsonb_equal(v,right[k]) for k,v in left.items())
    if isinstance(left,list):
        return isinstance(right,list) and len(left)==len(right) and all(jsonb_equal(a,b) for a,b in zip(left,right))
    if isinstance(left,bool) or left is None:
        return type(left) is type(right) and left==right
    if isinstance(left,(int,Decimal)):
        return not isinstance(right,bool) and isinstance(right,(int,Decimal)) and left==right
    return type(left) is type(right) and left==right


def verify_snapshot(session, source):
    from core import digest, load_json
    checksum=digest(source)
    session.rows("SELECT 1 / (EXISTS(SELECT 1 FROM stock_migration.import_batches WHERE checksum="+quote(checksum)+" AND workbook="+quote(source['spreadsheetId'])+"))::int;")
    relation='(SELECT snapshot FROM stock_migration.import_batches WHERE checksum='+quote(checksum)+') AS batch'
    # Compare every source field, including raw/formatted/formula/extension data.
    # Digest/workbook metadata alone is deliberately insufficient.
    with tempfile.TemporaryFile() as spool:
        for part in jsonb_fragments(session,'batch.snapshot',relation):spool.write(part.encode('utf8'))
        spool.seek(0)
        stored=load_json(spool.read())
        from snapshot_encoding import is_encoded_snapshot,decode_snapshot
        if is_encoded_snapshot(stored):
            from core import canonical
            stored=decode_snapshot(stored,expected_bytes=len(canonical(source).encode('utf8')),expected_sha256=checksum)
        if not jsonb_equal(source,stored):raise ValueError('full frozen snapshot differs from archive')
