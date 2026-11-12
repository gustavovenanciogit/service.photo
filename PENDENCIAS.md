# Pendências

## ✅ Concluído
- Tabela de preços 2026 transcrita do PDF (6 categorias, 30 itens) em `src/data/services.ts`
- WhatsApp (92) 98606-6741, Instagram @venart_mid e Fotto configurados em `src/config/site.ts`
- Condições de pagamento (30% de sinal · 3x sem juros · 5% no Pix) e todas as respostas do FAQ

## Para revisar
- [ ] **Nome no site:** está "Venart Fotógrafo" (logo: VENART). Ajuste `name` em `src/config/site.ts` se preferir outro formato.
- [ ] **Cabeçalho do PDF:** a arte da tabela ainda diz "GUSTAVO · FOTOGRAFIA" e "[SEU @INSTAGRAM] · [SEU WHATSAPP]". Vale atualizar a arte para "Venart", @venart_mid e (92) 98606-6741.
- [ ] **Plano mensal assessoria (R$ 1.500):** a tabela não mostra "/mês" nesse item (só "4 treinos por mês"), então o site também não mostra. Se for mensal, adicione `priceUnit: '/mês'`.
- [ ] **FAQ "cobertura personalizada":** a resposta foi montada a partir dos adicionais e do "sob consulta" da tabela. Confira o texto em `src/data/faq.ts`.

## Fotos
- [ ] Foto de destaque em `src/assets/hero/`
- [ ] Fotos do portfólio em `src/assets/portfolio/<categoria>/`
