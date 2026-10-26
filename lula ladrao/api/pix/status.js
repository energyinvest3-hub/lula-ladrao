'use strict';
const API_BASE='https://uruspaypagamentos.com/api/v1';
function reply(res,http,payload){res.statusCode=http;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(payload));}
module.exports=async function handler(req,res){
  if(req.method!=='GET')return reply(res,405,{ok:false,error:{code:'method_not_allowed',message:'Método não permitido.'}});
  const key=process.env.URUSPAY_API_KEY||'';
  if(!/^urus_(test|live)_[A-Za-z0-9_\-]+$/.test(key))return reply(res,503,{ok:false,error:{code:'pix_unconfigured',message:'O PIX não está configurado no servidor.'}});
  const id=String(req.query?.id||'');
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(id))return reply(res,400,{ok:false,error:{code:'invalid_id',message:'Cobrança inválida.'}});
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const upstream=await fetch(`${API_BASE}/status/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},signal:controller.signal});
    const data=await upstream.json().catch(()=>null);
    if(!upstream.ok||!data?.ok)return reply(res,upstream.status||502,{ok:false,error:{code:'status_unavailable',message:'Não foi possível consultar o pagamento. Tente novamente.'}});
    return reply(res,200,{ok:true,status:data.status||'pending',venda_id:data.venda_id||id});
  }catch{return reply(res,502,{ok:false,error:{code:'status_connection',message:'Falha temporária na consulta do pagamento.'}});}
  finally{clearTimeout(timer);}
};
