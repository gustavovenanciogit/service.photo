# Treinamento e validação facial (painel → Treinar IA)

## O que é treinado (e o que não é)
- O **modelo** (SFace 2021dec + YuNet 2023mar) é fixo: as respostas **não** re-treinam a rede.
- O que se ajusta é o **limiar** de semelhança (cosseno) usado na busca por selfie — geral ou por evento —
  e, quando mudam, os **filtros de qualidade** do índice (rosto ≥ 48 px, nitidez ≥ 100).
- Por isso o painel mostra a "melhora" como **escolha de um limiar melhor**, medida no mesmo conjunto.

## Conjunto de validação
- Avaliações **humanas** de pares de rostos (`face_labels`: par, pontuação gravada na hora, resposta).
- Origem: aba "Treinar reconhecimento" (pares escolhidos perto do limiar) e "Verificar candidatos" da pessoa de teste.
- Exemplos automáticos (rostos da mesma foto = pessoas diferentes) aparecem **à parte**; não entram nas métricas.

## Métricas (por par, num limiar t)
| Métrica | Fórmula | Observação |
|---|---|---|
| Recuperação | TP ÷ (TP + FN) | dos pares "mesma pessoa", quantos o limiar aceita |
| Precisão | TP ÷ (TP + FP) | depende da mistura da amostra (pares escolhidos perto do limiar) |
| Falsos positivos (FPR) | FP ÷ (FP + TN) | denominador: **todos** os pares "diferentes" avaliados — não é 1 − precisão |

Evidência suficiente: ≥ 15 pares "mesma pessoa" e ≥ 15 "diferentes". Abaixo disso, variações aparecem em cinza
e não há limiar recomendado.

## Sessões e gráfico
- Sessão = fotografia gravada (`face_sessions`) ao terminar um lote de pares e ao aplicar/restaurar um limiar
  (modelo, filtros, limiar, recomendado, contagens, métricas da época, id do conjunto). Nunca sobrescrita.
- O gráfico **recalcula todas as sessões com o conjunto de validação atual** (mesmo conjunto = comparação justa);
  a dica de cada ponto mostra também quantas avaliações havia na época.
- Menos de 2 sessões: "Histórico insuficiente".

## Comparação antes/depois
- Mesma pessoa de teste (um rosto do evento), mesmas fotos e mesmos rótulos; só o limiar muda.
- Por foto: a busca usa o rosto de maior pontuação; a foto é da pessoa se algum rosto dela foi verificado
  "mesma pessoa". Fotos sem verificação acima do limiar aparecem como "Não verificadas" (nem acerto nem erro).
- Candidatos para verificar: rostos de outras fotos com semelhança ≥ 0,20 (abaixo disso não são verificados).

## Aplicar e restaurar
- Aplicar: somente o evento (limiar próprio, `events.face_threshold`) ou o geral (eventos sem limiar próprio).
- Toda alteração fica em `face_threshold_log` com o valor anterior; "Restaurar" volta ao anterior.
- A busca por selfie usa o limiar do evento, se houver; senão o geral.

## Privacidade
- Página e rotas só com login. Recortes de rosto são feitos no navegador do fotógrafo a partir do original
  (rota protegida); nenhuma URL pública nova. As sessões guardam só números; nada biométrico em logs.
