# Corrigir o deploy do kit com PIX

## Problema confirmado
O repositório GitHub `energyinvest3-hub/lula-ladrao` contém somente `kit-vitoria-lula.html`. Não estão publicados `index.html`, `api/pix/health.js`, `api/pix/create.js` nem `api/pix/status.js`. Sem essas rotas a versão publicada é apenas estática e não gera cobranças.

## Atualizar o GitHub no Mac

1. Extraia o ZIP desta entrega no computador.
2. Abra o Terminal e execute (na conta GitHub com acesso de gravação):

```bash
git clone https://github.com/energyinvest3-hub/lula-ladrao.git
cd lula-ladrao
# Copie TODO o conteúdo da pasta extraída para cá, mantendo api/, lib/ e assets/
# (arraste a pasta para uma janela do Finder, se preferir)
git add -A
git commit -m "Adiciona site completo e backend PIX"
git push origin main
```

O arquivo antigo `kit-vitoria-lula.html` pode continuar no repositório; a página principal passa a ser `index.html`. Nunca inclua chaves reais nos arquivos versionados.

## Configurar a Vercel na conta desejada

- Importe `energyinvest3-hub/lula-ladrao` pelo GitHub na conta/equipe de destino.
- Root Directory: raiz (`./`); Framework Preset: Other.
- Verifique que `api/pix/{health,create,status}.js` entrou no deploy.
- Em Settings > Environment Variables, adicione `URUSPAY_API_KEY` como segredo para Preview e Production. Use uma **nova** chave de teste do painel da UrusPay (a anterior já foi compartilhada na conversa e não deve ser usada).
- Faça Redeploy. Acesse `/api/pix/health` para ver se a integração foi configurada.

## Diagnóstico

- `/api/pix/health` com 404: você ainda publicou só o HTML ou definiu a raiz errada.
- 503 e `pix_unconfigured`: falta a variável `URUSPAY_API_KEY`.
- 200 e `configured:true`: a variável foi detectada; isso **não** prova credencial válida nem conta aprovada.
- `/api/pix/create` com 401: chave rejeitada; 403: conta não autorizada; 422: dados recusados.
- `npm test` testa o backend sem executar cobranças reais.

## Antes de cobrar valores reais

Este projeto ainda não salva pedidos num banco e não tem um webhook autenticado para confirmar pagamentos. Implemente registro persistente dos pedidos, reconciliação das cobranças, política de privacidade, operação de entrega e confirmação de autorização para uso da marca e identidade comercial. Somente então habilite PIX de produção.
