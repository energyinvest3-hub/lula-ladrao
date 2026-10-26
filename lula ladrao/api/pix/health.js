'use strict';

/** Diagnóstico sem revelar a chave PIX. */
module.exports = function handler(req, res) {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ok:false,error:{code:'method_not_allowed',message:'Método não permitido.'}}));
  }
  const key = process.env.URUSPAY_API_KEY || '';
  const configured = /^urus_(test|live)_[A-Za-z0-9_\-]+$/.test(key);
  res.statusCode = configured ? 200 : 503;
  res.end(JSON.stringify({
    ok: configured,
    configured,
    mode: configured ? (key.startsWith('urus_test_') ? 'sandbox' : 'production') : 'unconfigured',
    ...(configured ? {} : {error:{code:'pix_unconfigured',message:'O PIX ainda não está configurado no servidor. Adicione URUSPAY_API_KEY nas variáveis de ambiente e faça um novo deploy.'}}),
  }));
};
