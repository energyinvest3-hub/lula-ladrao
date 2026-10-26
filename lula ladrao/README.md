# Kit Comemorativo — PIX UrusPay corrigido

Este projeto inclui a página do kit, seleção de frete, checkout e funções da API PIX preparadas para a Vercel.

## Por que o QR Code não aparecia?

O HTML independente (`.html`) não executa funções de servidor. O checkout usa rotas `/api/pix/create`, `/api/pix/status` e `/api/pix/health`, que precisam estar publicadas. A chave UrusPay deve existir como variável de ambiente no servidor, não no HTML ou no JavaScript do navegador.

## Publicar na Vercel (na conta correta)

1. Acesse a conta/equipe da Vercel em que deseja hospedar o site e importe **a pasta inteira do projeto**, não apenas `index.html`.
2. Selecione **Framework: Other**; a raiz do projeto deve conter `index.html`, `app.js`, `styles.css`, `api/` e `lib/`.
3. Em **Project → Settings → Environment Variables**, cadastre **`URUSPAY_API_KEY`** como variável *sensitive/encrypted* para Preview e Production. **Use primeiro uma chave `urus_test_...` válida, gerada no painel da UrusPay**. Não reutilize uma chave já compartilhada publicamente.
4. Faça **Redeploy** depois de criar/alterar a variável. As variáveis novas podem não valer no deploy anterior.
5. Abra `https://seu-site.vercel.app/api/pix/health`. O resultado deve ser `{"ok":true,"configured":true,"mode":"sandbox"}` enquanto estiver usando chave de testes.
6. Gere uma cobrança de teste no checkout; ela deve devolver o QR Code (ou, se a UrusPay não enviar imagem, a imagem é gerada localmente a partir de `pix_code`).
7. No sandbox o QR Code **não é pagável no banco**: para testar uma confirmação, use a ação de simular pagamento no painel/API da UrusPay. Consulte https://uruspaypagamentos.com/docs.

**Atenção:** se `/api/pix/health` devolver `404`, as funções da pasta `api/` não foram publicadas. Se devolver `503`, a variável de ambiente está faltando. Se a criação retornar `401`, a chave foi recusada pela UrusPay; se `403`, a conta pode não estar aprovada.

## Rodar localmente

Requer Node.js 20+.

```bash
npm start
```

Acesse `http://localhost:3000`. Sem `URUSPAY_API_KEY` a interface informará a falta de configuração. Para testar com sandbox, configure a chave localmente por variável de ambiente sem inseri-la em nenhum arquivo versionado.

## Testes automatizados

```bash
npm test
```

Eles simulam respostas da UrusPay e **não criam PIX real**.

## Segurança e liberação em produção

- Chave somente no servidor, com `Authorization: Bearer` para a UrusPay.
- Valor do frete calculado no servidor: PAC **R$ 24,90**, SEDEX **R$ 39,90**, Jadlog **R$ 49,90**.
- Erros explícitos no formulário e fallback local para gerar a imagem do QR Code.
- `Idempotency-Key` preservada ao tentar novamente após falhas de conexão, para reduzir duplicidade.
- Antes de aceitar dinheiro de clientes, **implemente persistência segura de pedidos/endereço, webhook com assinatura validada e operação de expedição**. O projeto ainda não possui um banco de dados de pedidos. Portanto **não está pronto para operar vendas reais com segurança**, embora o código de criação de cobranças e consulta de status esteja implementado.
- Faça validação da oferta, estoque, prazos de entrega e autorização de uso da marca antes de publicar publicamente.
- A chave anteriormente colada na conversa deve ser revogada e substituída.

A biblioteca `lib/vendor/QRCode` é derivada de QRCode for JavaScript de Kazuhiko Arase (licença MIT), incorporada para gerar QR local quando não houver imagem devolvida pelo gateway.
