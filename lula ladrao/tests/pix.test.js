'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const create=require('../api/pix/create');
const health=require('../api/pix/health');
const status=require('../api/pix/status');
const {pixQrSvgDataUrl}=require('../lib/pix-qr');

function req(method='POST',body={}){
  return {method,body,query:{},headers:{'x-idempotency-key':'pedido-qa-12345'}};
}
function res(){return {
  statusCode:200, headers:{},body:null,
  setHeader(k,v){this.headers[k.toLowerCase()]=v;},
  end(v){this.body=JSON.parse(v);return this;}
};}
const payload={nome:'Maria Silva',email:'maria@example.com',cpf:'',telefone:'',tamanho_camiseta:'M',shipping_method:'sedex',endereco:{cep:'01310100',estado:'SP',cidade:'São Paulo',rua:'Av Paulista',numero:'100'}};

const prevKey=process.env.URUSPAY_API_KEY;
const prevFetch=global.fetch;
test.after(()=>{if(prevKey===undefined)delete process.env.URUSPAY_API_KEY;else process.env.URUSPAY_API_KEY=prevKey;global.fetch=prevFetch;});

test('sem chave: erro claro e nenhum acesso à adquirente',async()=>{
  delete process.env.URUSPAY_API_KEY;
  global.fetch=()=>{throw Error('Não chamar adquirente');};
  const output=res();await create(req('POST',payload),output);
  assert.equal(output.statusCode,503);
  assert.equal(output.body.error.code,'pix_unconfigured');
  assert.equal(output.headers['cache-control'],'no-store');
});

test('health: estado da integração sem revelar credenciais',async()=>{
  process.env.URUSPAY_API_KEY='urus_test_FAKE_CRED_TEST';
  const output=res();await health(req('GET'),output);
  assert.equal(output.body.ok,true);
  assert.equal(output.body.mode,'sandbox');
  assert.equal(JSON.stringify(output.body).includes('FAKE_CRED'),false);
});

test('sucesso: valor calculado no servidor e QR gerado se faltou URL da UrusPay',async()=>{
  process.env.URUSPAY_API_KEY='urus_test_FAKE_CRED_TEST';
  global.fetch=async(url,options)=>{
    assert.equal(url,'https://uruspaypagamentos.com/api/v1/charge');
    assert.equal(options.headers['Idempotency-Key'],'pedido-qa-12345');
    assert.equal(options.headers.Authorization,'Bearer urus_test_FAKE_CRED_TEST');
    const sent=JSON.parse(options.body);
    assert.equal(sent.valor,39.90);
    assert.equal(sent.cpf,undefined);
    return {ok:true,status:200,json:async()=>({ok:true,venda_id:'sbx_123',status:'pending',pix_code:'000201010212520400005303986540510.005802BR5912TESTE PIX LTDA6304BEEF'})};
  };
  const output=res();await create(req('POST',{...payload,valor:0.01}),output);
  assert.equal(output.statusCode,200);
  assert.equal(output.body.valor,39.9);
  assert.match(output.body.qr_code_url,/^data:image\/svg\+xml;base64,/);
  assert.equal(output.body.mode,'sandbox');
});

test('aceita QR base64 puro enviado pela UrusPay',async()=>{
  process.env.URUSPAY_API_KEY='urus_test_FAKE_CRED_TEST';
  global.fetch=async()=>({ok:true,status:200,json:async()=>({ok:true,venda_id:123,pix_code:'000201FAKE',qr_code_url:'aGVsbG8='.repeat(20)})});
  const output=res();await create(req('POST',payload),output);
  assert.equal(output.statusCode,200);
  assert.match(output.body.qr_code_url,/^data:image\/png;base64,/);
});

test('erro de autenticação é explicado sem divulgar chave',async()=>{
  process.env.URUSPAY_API_KEY='urus_live_FAKE_CRED_TEST';
  global.fetch=async()=>({ok:false,status:401,json:async()=>({ok:false,error:{message:'Unauthorized'}})});
  const output=res();await create(req('POST',payload),output);
  assert.equal(output.statusCode,401);
  assert.equal(output.body.error.code,'gateway_auth');
  assert.equal(JSON.stringify(output.body).includes('FAKE_CRED_TEST'),false);
});

test('exigência de CPF vira mensagem acionável',async()=>{
  process.env.URUSPAY_API_KEY='urus_test_FAKE_CRED_TEST';
  global.fetch=async()=>({ok:false,status:422,json:async()=>({ok:false,error:{message:'CPF obrigatório para esta cobrança'}})});
  const output=res();await create(req('POST',payload),output);
  assert.equal(output.body.error.code,'cpf_required');
});

test('consulta da cobrança usa rota correta',async()=>{
  process.env.URUSPAY_API_KEY='urus_test_FAKE_CRED_TEST';
  global.fetch=async(url,options)=>{
    assert.equal(url,'https://uruspaypagamentos.com/api/v1/status/sbx_123');
    return {ok:true,status:200,json:async()=>({ok:true,venda_id:'sbx_123',status:'paid'})};
  };
  const output=res();await status({...req('GET'),query:{id:'sbx_123'}},output);
  assert.equal(output.body.status,'paid');
});

test('QR local contém SVG válido',()=>{
 const svg=Buffer.from(pixQrSvgDataUrl('000201PIXFAKE').split(',')[1],'base64').toString('utf8');
 assert.match(svg,/<svg /);
 assert.match(svg,/<path d=/);
});
