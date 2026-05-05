# Sistema de Controle de Ponto e Pagamento da Construtora

## Cenário

Uma construtora possui colaboradores em três modalidades: CLT, PJ e Diaristas. O departamento de Tecnologia precisa auxiliar o RH na criação de um sistema para controle de ponto e geração automática dos pagamentos, com fechamento semanal.

---

## Parte 1: Arquitetura e Regras de Negócio

### 1. Estrutura do banco de dados

A modelagem separa os dados básicos na tabela principal `colaboradores` e isola as regras de remuneração em tabelas específicas (`colaboradores_clt`, `colaboradores_pj` e `colaboradores_diarista`), evitando campos vazios e misturados. 

O registro de ponto diário é unificado para todos os perfis. Já o cálculo financeiro acontece na geração da tabela `fechamentos_semanais`, que serve como histórico de auditoria dos valores apurados para evitar alterações indevidas.

---

### 2. Convivência entre fechamento semanal e folha mensal CLT

O sistema roda um fechamento toda semana para todos os colaboradores, mas com efeitos diferentes. Para PJ e Diarista, o fechamento semanal já aciona o pagamento direto. 

Para o colaborador CLT, o fechamento semanal funciona apenas como uma **provisão contábil** para o financeiro organizar o fluxo de caixa. O pagamento real só acontece no fechamento do mês, quando o sistema consolida essas semanas acumuladas e aplica os descontos legais no holerite.

---

## Parte 2: Desafio de Lógica

### Lógicas adotadas

Os cálculos utilizam o divisor mensal de 220 horas para a jornada padrão de 44 horas semanais, com as horas extras de João calculadas com adicional de 50%. O fechamento semanal CLT é gerado apenas como provisão, deixando o pagamento efetivo para a folha mensal. Por fim, o pagamento PJ fica estritamente condicionado à emissão da nota fiscal.

---

## Parte 2: Desafio de Lógica

### Lógicas adotadas

- Divisor mensal de **220h** para jornada CLT de 44h semanais (convenção consolidada no mercado).
- Horas extras de João calculadas com adicional de **50%**, conforme especificado no enunciado.
- Fechamento CLT gerado como **provisão** — o pagamento real ocorre na folha mensal, com aplicação dos descontos legais.
- Pagamento PJ condicionado à emissão de nota fiscal pelo prestador.

---

### Implementação (TypeScript)
Execute o arquivo "banco_de_dados.ts" via terminal em seu diretorio com o comando npx tsx banco_de_dados.ts (caso necessario, baixe as dependencias via terminal com "npm install")
 
---

### Saída esperada

| Nome  | Tipo     | Valor Bruto   | Status   | Detalhamento                                      |
|-------|----------|---------------|----------|---------------------------------------------------|
| João  | CLT      | R$ 515,00     | PROVISAO | 44h normais × R$10,00 + 5h extras × R$15,00      |
| Maria | PJ       | R$ 2.000,00   | A_PAGAR  | 40h × R$50,00/h                                   |
| José  | Diarista | R$ 450,00     | A_PAGAR  | 3 dias × R$150,00/dia                             |

> **Nota — João (CLT):** o valor de R$ 515,00 é uma provisão semanal para o fluxo de caixa do financeiro. O pagamento real ocorre no fechamento mensal da folha apos aplicação dos descontos legais obrigatórios sobre o total bruto acumulado no mês.
