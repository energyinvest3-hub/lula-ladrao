'use strict';

const CONFIG = Object.freeze({
  freight: {
    pac: { label: 'Correios PAC', cents: 2490 },
    sedex: { label: 'SEDEX', cents: 3990 },
    jadlog: { label: 'Jadlog', cents: 4990 },
  },
  productCents: 0,
});

const GALLERY = [
  { src: 'assets/kit-completo.webp', alt: 'Os cinco itens do kit juntos em uma foto realista' },
  { src: 'assets/bone-lula.webp', alt: 'Boné vermelho com escrita LULA' },
  { src: 'assets/ecobag-lula.webp', alt: 'Ecobag bege com ilustração do Lula' },
  { src: 'assets/camiseta-ditadura-nunca-mais.webp', alt: 'Camiseta preta Ditadura Nunca Mais' },
  { src: 'assets/calendario-bloquinho.webp', alt: 'Kit bloquinho e calendário vermelhos' },
  { src: 'assets/meias-pe-de-meia.webp', alt: 'Par de meias pretas Pé de Meia' },
];

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const formatMoney = (cents) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

let galleryIndex = 0;
let toastTimeout;
let statusPoll = null;
let currentChargeId = null;
let checkoutRequestKey = null;

function currentShipping() {
  return $('input[name="shipping"]:checked')?.value || 'sedex';
}

function selectedCarrier() {
  return CONFIG.freight[currentShipping()];
}

function currentTotalCents() {
  return CONFIG.productCents + selectedCarrier().cents;
}

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3400);
}

function setButtonLoading(button, isLoading, label = 'Processando...') {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = label;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) button.innerHTML = button.dataset.originalText;
  }
}

function showGallery(index) {
  const nextIndex = (index + GALLERY.length) % GALLERY.length;
  galleryIndex = nextIndex;
  const main = $('#heroImage');
  const next = GALLERY[galleryIndex];
  main.classList.add('switching');
  const preload = new Image();
  preload.onload = () => {
    main.src = next.src;
    main.alt = next.alt;
    requestAnimationFrame(() => main.classList.remove('switching'));
  };
  preload.onerror = () => main.classList.remove('switching');
  preload.src = next.src;
  $$('.thumb').forEach((button, buttonIndex) => {
    const active = buttonIndex === galleryIndex;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  $$('.thumb')[galleryIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function updateShipping() {
  $$('.shipping-option').forEach(label => {
    const input = $('input', label);
    label.classList.toggle('selected', Boolean(input?.checked));
  });

  const total = currentTotalCents();
  const carrier = selectedCarrier();
  $('#totalPrice').textContent = formatMoney(total);
  $('#mobilePrice').textContent = formatMoney(total);
  $('#summaryCarrier').textContent = carrier.label;
  $('#summaryFreight').textContent = formatMoney(carrier.cents);
  $('#summaryTotal').textContent = formatMoney(total);
  $('#formTotalPrice').textContent = formatMoney(total);
  const pixAmount = $('#pixAmount');
  if (pixAmount) pixAmount.textContent = formatMoney(total);
}

function maskCep(value) {
  const numbers = value.replace(/\D/g, '').slice(0, 8);
  return numbers.length > 5 ? `${numbers.slice(0, 5)}-${numbers.slice(5)}` : numbers;
}

function maskCpf(value) {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
}

function validCpf(input) {
  const cpf = String(input || '').replace(/\D/g, '');
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let first = (sum * 10) % 11;
  if (first === 10) first = 0;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let second = (sum * 10) % 11;
  if (second === 10) second = 0;
  return first === Number(cpf[9]) && second === Number(cpf[10]);
}

function maskPhone(value) {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 2) return numbers.length ? `(${numbers}` : '';
  if (numbers.length <= 6) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 10) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
}

function showPixError(message) {
  const box=$('#pixError');
  if (!box) return;
  box.textContent=message;
  box.hidden=false;
  box.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function clearPixError() {
  const box=$('#pixError');
  if(box){box.textContent='';box.hidden=true;}
}
async function checkPixConnection() {
  const status=$('#pixConnectionStatus');
  const button=$('#generatePixButton');
  if(location.protocol==='file:'){
    status.textContent='PIX indisponível em arquivo local. Publique na Vercel com as funções API.';
    button.disabled=true;
    showPixError('Este HTML é apenas uma visualização. Para gerar PIX, abra a versão publicada na Vercel, com a chave URUSPAY_API_KEY configurada no servidor.');
    return;
  }
  status.textContent='Verificando conexão segura com o PIX...';
  try{
    const resp=await fetch('/api/pix/health',{headers:{Accept:'application/json'},cache:'no-store'});
    const data=await resp.json().catch(()=>null);
    if(!resp.ok||!data?.configured){
      button.disabled=true;
      const msg=data?.error?.message || (resp.status===404
        ? 'A função de pagamento não foi publicada na Vercel. Faça deploy da pasta completa, incluindo /api/pix.'
        : 'A integração PIX não está disponível neste servidor.');
      status.textContent='PIX não configurado';
      showPixError(msg);
      return;
    }
    button.disabled=false;
    status.textContent=data.mode==='sandbox'?'Ambiente de teste PIX (não aceita pagamentos reais).':'Conexão PIX configurada';
    clearPixError();
  }catch(error){
    button.disabled=true;
    status.textContent='Falha ao verificar conexão';
    showPixError('Não foi possível acessar a API PIX do site. Confira se ele está aberto em um endereço da Vercel e se as rotas /api/pix estão publicadas.');
  }
}

function resetPixState() {
  clearInterval(statusPoll);
  statusPoll = null;
  currentChargeId = null;
  checkoutRequestKey = null;
  clearPixError();
  const connection=$('#pixConnectionStatus');
  if(connection) connection.textContent='Verificando conexão de pagamento...';
  $('#checkoutForm').hidden = false;
  $('#pixResult').hidden = true;
  $('#pixModeNotice').hidden = true;
  $('#pixSuccess').hidden = true;
  $('#paymentStatus').textContent = 'Aguardando pagamento...';
  $('#paymentStatus').className = 'payment-status pending';
  $('#pixCode').value = '';
  $('#pixQrImage').removeAttribute('src');
  $('.pix-qr-wrap').hidden = true;
  $('#pixExpiry').textContent = '—';
  $('#qrFallback').hidden = true;
}

function openCheckout() {
  const size = $('#shirtSize').value;
  if (!size) {
    showToast('Escolha o tamanho da camiseta para continuar.');
    $('#shirtSize').focus({ preventScroll: true });
    $('#shirtSize').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  $('#summarySize').textContent = size;
  updateShipping();
  resetPixState();
  $('#checkoutDialog').showModal();
  document.body.style.overflow = 'hidden';
  checkPixConnection();
}

function closeCheckout() {
  clearInterval(statusPoll);
  statusPoll = null;
  $('#checkoutDialog').close();
  document.body.style.overflow = '';
}

async function searchCep(cep, feedback, fields = null) {
  const digits = cep.replace(/\D/g, '');
  feedback.classList?.remove('ok', 'error');
  if (digits.length !== 8) {
    feedback.textContent = 'Digite um CEP válido com 8 números.';
    feedback.classList?.add('error');
    return;
  }
  feedback.textContent = 'Consultando o CEP…';
  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw Error('Serviço temporariamente indisponível');
    const result = await response.json();
    if (result.erro) throw Error('CEP não localizado');
    feedback.textContent = `${result.localidade}/${result.uf} localizado com sucesso.`;
    feedback.classList?.add('ok');
    if (fields) {
      if (result.logradouro) fields.street.value = result.logradouro;
      if (result.localidade) fields.city.value = result.localidade;
      if (result.uf) fields.state.value = result.uf;
      if (result.bairro) fields.district.value = result.bairro;
    }
  } catch (error) {
    feedback.textContent = 'Não foi possível consultar o CEP agora. Você pode preencher manualmente.';
    feedback.classList?.add('error');
  }
}

async function createPixCharge(payload) {
  if (location.protocol === 'file:') {
    throw new Error('Para gerar PIX, execute o site por um servidor com a integração configurada.');
  }
  if (!checkoutRequestKey) checkoutRequestKey = `kit-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  let response;
  try {
    response = await fetch('/api/pix/create', {
      method:'POST',
      headers:{'Content-Type':'application/json',Accept:'application/json','X-Idempotency-Key':checkoutRequestKey},
      body:JSON.stringify(payload),
    });
  } catch {
    throw new Error('Falha ao conectar ao servidor. Confira sua conexão e o endereço do site.');
  }
  const data=await response.json().catch(()=>null);
  if(response.status===404) throw new Error('A rota de pagamento /api/pix/create não foi encontrada. Publique a pasta completa na Vercel.');
  if(!response.ok || !data?.ok){
    const error=new Error(data?.error?.message||data?.message||`Não foi possível gerar a cobrança (HTTP ${response.status}).`);
    error.code=data?.error?.code||'';
    throw error;
  }
  if(!data.pix_code || data.venda_id==null) throw new Error('A UrusPay não retornou o código PIX. Consulte a configuração do gateway.');
  return data;
}

async function fetchPixStatus(vendaId) {
  const response = await fetch(`/api/pix/status?id=${encodeURIComponent(vendaId)}`, {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data?.error?.message || data?.message || 'Não foi possível consultar o status do pagamento.');
  }
  return data;
}

function renderPixCharge(charge) {
  $('#checkoutForm').hidden = true;
  $('#pixResult').hidden = false;
  $('#pixModeNotice').hidden = charge.mode!=='sandbox';
  $('#pixSuccess').hidden = true;
  const qr = $('#pixQrImage');
  const qrWrap = $('.pix-qr-wrap');
  qr.onerror = () => { qrWrap.hidden = true; qr.hidden = true; $('#qrFallback').hidden=false; };
  qr.onload = () => { qrWrap.hidden = false; qr.hidden = false; $('#qrFallback').hidden=true; };
  if (charge.qr_code_url) { qr.src = charge.qr_code_url; qr.hidden = false; }
  else { qr.removeAttribute('src'); qr.hidden = true; qrWrap.hidden = true; $('#qrFallback').hidden=false; }
  $('#pixCode').value = charge.pix_code || '';
  $('#pixAmount').textContent = formatMoney(Math.round((charge.valor || currentTotalCents() / 100) * 100));
  $('#pixExpiry').textContent = charge.expira_em ? new Date(charge.expira_em).toLocaleString('pt-BR') : 'Em breve';
  currentChargeId = charge.venda_id;
  const paymentStatus = $('#paymentStatus');
  paymentStatus.textContent = 'Aguardando pagamento...';
  paymentStatus.className = 'payment-status pending';

  clearInterval(statusPoll);
  statusPoll = setInterval(async () => {
    if (!currentChargeId) return;
    try {
      const status = await fetchPixStatus(currentChargeId);
      applyStatus(status.status);
    } catch (error) {
      console.warn(error);
    }
  }, 5000);
}

function applyStatus(status) {
  const paymentStatus = $('#paymentStatus');
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') {
    clearInterval(statusPoll);
    statusPoll = null;
    paymentStatus.textContent = 'Pagamento confirmado!';
    paymentStatus.className = 'payment-status paid';
    $('#pixResult').hidden = true;
    $('#pixSuccess').hidden = false;
    return;
  }
  if (normalized === 'cancelled') {
    clearInterval(statusPoll);
    statusPoll = null;
    paymentStatus.textContent = 'Cobrança expirada ou cancelada. Gere um novo PIX.';
    paymentStatus.className = 'payment-status expired';
    return;
  }
  paymentStatus.textContent = 'Aguardando pagamento...';
  paymentStatus.className = 'payment-status pending';
}

async function handleCheckoutSubmit(event) {
  event.preventDefault();
  const cep = $('#checkoutCep').value.replace(/\D/g, '');
  const cpf = $('#orderCpf').value.replace(/\D/g, '');
  const phone = $('#orderPhone').value.replace(/\D/g, '');
  if (cep.length !== 8) {
    $('#checkoutCep').setCustomValidity('O CEP precisa ter 8 números.');
    $('#checkoutCep').reportValidity();
    return;
  }
  if (cpf && !validCpf(cpf)) {
    $('#orderCpf').setCustomValidity('Digite um CPF válido ou deixe o campo vazio.');
    $('#orderCpf').reportValidity();
    return;
  }
  if (phone && phone.length < 10) {
    $('#orderPhone').setCustomValidity('Informe um telefone com DDD ou deixe em branco.');
    $('#orderPhone').reportValidity();
    return;
  }
  $('#checkoutCep').setCustomValidity('');
  $('#orderCpf').setCustomValidity('');
  $('#orderPhone').setCustomValidity('');

  const button = $('#generatePixButton');
  clearPixError();
  setButtonLoading(button, true, 'GERANDO PIX...');
  try {
    const carrier = selectedCarrier();
    const charge = await createPixCharge({
      valor: currentTotalCents() / 100,
      nome: $('#orderName').value.trim(),
      email: $('#orderEmail').value.trim(),
      cpf,
      telefone: phone,
      descricao: `Kit Comemorativo da Vitória - ${carrier.label} - Tamanho ${$('#shirtSize').value}`,
      tamanho_camiseta: $('#shirtSize').value,
      frete: carrier.label,
      shipping_method: currentShipping(),
      endereco: {
        cep,
        estado: $('#state').value.trim(),
        cidade: $('#city').value.trim(),
        bairro: $('#district').value.trim(),
        rua: $('#street').value.trim(),
        numero: $('#streetNumber').value.trim(),
        complemento: $('#complement').value.trim(),
      },
      produto: 'Kit Comemorativo da Vitória',
    });
    renderPixCharge(charge);
  } catch (error) {
    showPixError(error.message || 'Não foi possível gerar o pagamento.');
    if(error.code==='cpf_required'){
      const cpf=$('#orderCpf');
      cpf.focus({preventScroll:true});
      cpf.scrollIntoView({behavior:'smooth',block:'center'});
    }
    if(['invalid_freight','invalid_customer','invalid_cpf','invalid_phone','invalid_size','invalid_cep','invalid_address','cpf_required','gateway_validation'].includes(error.code)) checkoutRequestKey=null;
  } finally {
    setButtonLoading(button, false);
  }
}

async function copyPixCode() {
  const field = $('#pixCode');
  if (!field.value) return;
  try {
    await navigator.clipboard.writeText(field.value);
    showToast('Código PIX copiado.');
  } catch {
    field.select();
    document.execCommand('copy');
    showToast('Código PIX copiado.');
  }
}

async function checkPixStatusManually() {
  if (!currentChargeId) return;
  const button = $('#checkPixStatusButton');
  setButtonLoading(button, true, 'VERIFICANDO...');
  try {
    const status = await fetchPixStatus(currentChargeId);
    applyStatus(status.status);
    if (String(status.status).toLowerCase() !== 'paid') {
      showToast('Pagamento ainda não identificado.');
    }
  } catch (error) {
    showToast(error.message || 'Falha ao verificar o pagamento.');
  } finally {
    setButtonLoading(button, false);
  }
}

function init() {
  $('#year').textContent = new Date().getFullYear();
  $$('.thumb').forEach(btn => btn.addEventListener('click', () => showGallery(Number(btn.dataset.galleryIndex))));
  $('#prevImage').addEventListener('click', () => showGallery(galleryIndex - 1));
  $('#nextImage').addEventListener('click', () => showGallery(galleryIndex + 1));
  $$('#shippingOptions input').forEach(radio => radio.addEventListener('change', updateShipping));
  ['buyButton', 'mobileBuyButton', 'cartButton'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.addEventListener('click', openCheckout);
  });

  $('#closeDialog').addEventListener('click', closeCheckout);
  $('#returnButton').addEventListener('click', closeCheckout);
  $('#checkoutDialog').addEventListener('close', () => {
    document.body.style.overflow = '';
    clearInterval(statusPoll);
    statusPoll = null;
  });
  $('#checkoutDialog').addEventListener('click', event => {
    if (event.target === $('#checkoutDialog')) closeCheckout();
  });

  $('#favoriteButton').addEventListener('click', event => {
    const pressed = event.currentTarget.getAttribute('aria-pressed') !== 'true';
    event.currentTarget.setAttribute('aria-pressed', String(pressed));
    event.currentTarget.classList.toggle('pressed', pressed);
    showToast(pressed ? 'Kit adicionado aos favoritos.' : 'Kit removido dos favoritos.');
  });

  const menuButton = $('#menuButton');
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    $('#mobileNav').hidden = isOpen;
  });
  $$('#mobileNav a').forEach(link => link.addEventListener('click', () => {
    $('#mobileNav').hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
  }));

  const checkoutCep = $('#checkoutCep');
  checkoutCep.addEventListener('input', () => {
    checkoutCep.value = maskCep(checkoutCep.value);
    checkoutCep.setCustomValidity('');
  });
  checkoutCep.addEventListener('blur', () => {
    if (checkoutCep.value.replace(/\D/g, '').length === 8) {
      searchCep(checkoutCep.value, $('#checkoutCepFeedback'), {
        street: $('#street'), city: $('#city'), state: $('#state'), district: $('#district')
      });
    }
  });

  const cpf = $('#orderCpf');
  cpf.addEventListener('input', () => { cpf.value = maskCpf(cpf.value); cpf.setCustomValidity(''); });
  const phone = $('#orderPhone');
  phone.addEventListener('input', () => { phone.value = maskPhone(phone.value); phone.setCustomValidity(''); });

  $('#checkoutForm').addEventListener('input',()=>{ checkoutRequestKey=null; clearPixError(); });
  $$('#shippingOptions input').forEach(radio=>radio.addEventListener('change',()=>{checkoutRequestKey=null;clearPixError();}));
  $('#checkoutForm').addEventListener('submit', handleCheckoutSubmit);
  $('#copyPixButton').addEventListener('click', copyPixCode);
  $('#checkPixStatusButton').addEventListener('click', checkPixStatusManually);

  updateShipping();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
