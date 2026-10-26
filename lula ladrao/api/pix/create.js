'use strict';
const crypto = require('crypto');
const {pixQrSvgDataUrl}=require('../../lib/pix-qr');
const API_BASE = 'https://uruspaypagamentos.com/api/v1';
const FREIGHT_CENTS = Object.freeze({pac:2490, sedex:3990, jadlog:4990});
const FREIGHT_LABELS = Object.freeze({pac:'Correios PAC', sedex:'SEDEX', jadlog:'Jadlog'});

function reply(res, status, result) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(result));
}
function fail(res, httpStatus, code, message, details) {
  return reply(res,httpStatus,{ok:false,error:{code,message,...(details?{details}:{})}});
}
function validCpf(value) {
  const cpf=String(value||'').replace(/\D/g,'');
  if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf))return false;
  let a=0,b=0;
  for(let i=0;i<9;i++)a+=Number(cpf[i])*(10-i);
  a=(a*10)%11;if(a===10)a=0;
  for(let i=0;i<10;i++)b+=Number(cpf[i])*(11-i);
  b=(b*10)%11;if(b===10)b=0;
  return a===Number(cpf[9])&&b===Number(cpf[10]);
}
function upstreamError(status, payload) {
  const raw=String(payload?.error?.message||payload?.message||'');
  const normalized=raw.toLowerCase();
  if(status===401) return {code:'gateway_auth',message:'A chave de pagamento foi recusada. Confira a chave UrusPay nas configurações da Vercel.'};
  if(status===403) return {code:'gateway_not_approved',message:'A conta UrusPay ainda não está aprovada para criar cobranças. Confira o cadastro no painel.'};
  if(status===429) return {code:'gateway_limit',message:'Muitas tentativas de pagamento. Aguarde um instante e tente novamente.'};
  if(status===409) return {code:'gateway_conflict',message:'Uma cobrança idêntica ainda está sendo processada. Tente novamente em alguns segundos.'};
  if(/cpf|documento/i.test(raw)) return {code:'cpf_required',message:'A operadora PIX exige CPF para esta cobrança. Preencha o CPF no formulário e tente novamente.'};
  if(status>=500) return {code:'gateway_unavailable',message:'O serviço de pagamentos está temporariamente indisponível. Tente novamente em alguns minutos.'};
  if(status===400 || status===422) return {code:'gateway_validation',message:raw.slice(0,200)||'O gateway recusou os dados informados. Confira o formulário.'};
  return {code:'gateway_error',message:'Não foi possível gerar o PIX. Confira os dados e tente novamente.'};
}

function normalizeQr(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const s=raw.trim();
  if(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(s)) return s;
  if(/^https:\/\//i.test(s)) return s;
  if(/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length>80) return `data:image/png;base64,${s.replace(/\s+/g,'')}`;
  return null;
}

module.exports = async function handler(req,res) {
  if(req.method!=='POST')return fail(res,405,'method_not_allowed','Use POST para gerar o PIX.');
  const key=process.env.URUSPAY_API_KEY || '';
  if(!/^urus_(test|live)_[A-Za-z0-9_\-]+$/.test(key))
    return fail(res,503,'pix_unconfigured','O PIX ainda não está configurado. Adicione URUSPAY_API_KEY na Vercel e faça um novo deploy.');

  let body;
  try { body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}); }
  catch{return fail(res,400,'invalid_json','Os dados da compra estão inválidos.');}
  if(typeof body!=='object'||Array.isArray(body))return fail(res,400,'invalid_json','Os dados da compra estão inválidos.');

  const shipping=String(body.shipping_method||'');
  if(!Object.hasOwn(FREIGHT_CENTS,shipping))return fail(res,400,'invalid_freight','Escolha uma modalidade de frete.');
  const nome=String(body.nome||'').trim().slice(0,120);
  const email=String(body.email||'').trim().slice(0,200);
  const cpf=String(body.cpf||'').replace(/\D/g,'');
  const telefone=String(body.telefone||'').replace(/\D/g,'');
  const tamanho=String(body.tamanho_camiseta||'');
  const endereco=body.endereco||{};
  if(nome.length<3||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fail(res,400,'invalid_customer','Informe nome e e-mail válidos.');
  if(cpf&&!validCpf(cpf))return fail(res,400,'invalid_cpf','O CPF informado não é válido.');
  if(telefone&&!/^\d{10,11}$/.test(telefone))return fail(res,400,'invalid_phone','Informe telefone com DDD ou deixe em branco.');
  if(!['P','M','G','GG'].includes(tamanho))return fail(res,400,'invalid_size','Escolha o tamanho da camiseta.');
  if(!/^\d{8}$/.test(String(endereco.cep||'').replace(/\D/g,'')))return fail(res,400,'invalid_cep','Informe um CEP válido.');
  if(!String(endereco.rua||'').trim()||!String(endereco.numero||'').trim()||!String(endereco.cidade||'').trim()||!/^[A-Za-z]{2}$/.test(String(endereco.estado||'').trim()))
    return fail(res,400,'invalid_address','Complete o endereço de entrega.');

  const requestKey=String(req.headers['x-idempotency-key']||'');
  const idempotencyKey=/^[A-Za-z0-9_.:\-]{6,80}$/.test(requestKey)?requestKey:`kit-${crypto.randomUUID()}`;
  const valor=FREIGHT_CENTS[shipping]/100;
  const payload={valor,nome,email,
    ...(cpf?{cpf}:{}), ...(telefone?{telefone}:{}),
    descricao:`Kit Comemorativo da Vitória • ${FREIGHT_LABELS[shipping]} • ${tamanho}`.slice(0,160)};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const upstream=await fetch(`${API_BASE}/charge`,{
      method:'POST',signal:controller.signal,
      headers:{Authorization:`Bearer ${key}`, 'Content-Type':'application/json',Accept:'application/json','Idempotency-Key':idempotencyKey},
      body:JSON.stringify(payload)
    });
    const data=await upstream.json().catch(()=>null);
    if(!upstream.ok||!data?.ok){
      const err=upstreamError(upstream.status,data);
      return fail(res,upstream.status||502,err.code,err.message);
    }
    const pixCode=typeof data.pix_code==='string'?data.pix_code.trim():'';
    if(!pixCode||data.venda_id==null)
      return fail(res,502,'gateway_invalid_response','O gateway não retornou um código PIX válido. Confira o painel da UrusPay.');
    let qrCode=normalizeQr(data.qr_code_url);
    if(!qrCode){try{qrCode=pixQrSvgDataUrl(pixCode);}catch{qrCode=null;}}
    return reply(res,200,{
      ok:true,venda_id:data.venda_id,status:data.status||'pending',
      valor:valor,pix_code:pixCode,qr_code_url:qrCode,
      expira_em:data.expira_em||null,mode:key.startsWith('urus_test_')?'sandbox':'production',
    });
  } catch(error) {
    return fail(res,502,error?.name==='AbortError'?'gateway_timeout':'gateway_connection',
      error?.name==='AbortError'?'A UrusPay demorou a responder. Tente novamente.':'Não foi possível conectar à UrusPay. Verifique a conexão do servidor.');
  } finally {clearTimeout(timer);}
};
