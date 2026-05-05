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

### 2. Convivência entre fechamento semanal e folha mensal CLT

Essa é a tensão mais delicada do sistema porque envolve dois ritmos diferentes com finalidades distintas: o financeiro precisa de visibilidade semanal para planejar o caixa, enquanto a legislação trabalhista exige que o pagamento CLT seja consolidado mensalmente, com os descontos legais e valor de FGTS.

A solução é tratar esses dois fluxos como paralelos e independentes, sem tentar unificá-los numa única operação. A cada semana, o sistema gera um fechamento para todos os colaboradores, independente do tipo de contrato. Para PJ e diaristas, esse fechamento é o gatilho direto do pagamento, desde que as condições estejam satisfeitas — nota fiscal emitida no caso do PJ. Para o colaborador CLT, o fechamento semanal cumpre um papel diferente: ele não gera pagamento, mas sim uma **provisão contábil** que alimenta o fluxo de caixa projetado do financeiro. O sistema acumula, semana a semana, as horas trabalhadas, as horas extras e os adicionais devidos em um registro mensal de acumulação vinculado àquele colaborador e àquele mês de referência.

No fechamento mensal — tipicamente no último dia útil do mês — o sistema consolida os quatro ou cinco acumulados semanais, calcula os descontos legais sobre o total bruto e gera o holerite definitivo. Apenas nesse momento o pagamento CLT é efetivado.

Essa separação resolve o problema sem violar nenhuma das duas exigências: o financeiro enxerga semana a semana o quanto está comprometido com a folha CLT por meio das provisões, e o RH processa a folha mensalmente dentro das obrigações legais. O colaborador CLT recebe corretamente no fechamento do mês, e o sistema mantém rastreabilidade completa de como aquele valor foi composto ao longo das semanas.

---

## Parte 2: Desafio de Lógica

### Lógicas adotadas

- Divisor mensal de **220h** para jornada CLT de 44h semanais (convenção consolidada no mercado).
- Horas extras de João calculadas com adicional de **50%**, conforme especificado no enunciado.
- Fechamento CLT gerado como **provisão** — o pagamento real ocorre na folha mensal, com aplicação dos descontos legais.
- Pagamento PJ condicionado à emissão de nota fiscal pelo prestador.

---

### Implementação (TypeScript)

```typescript
// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

type TipoContrato = "CLT" | "PJ" | "DIARISTA";

interface RegistroPonto {
  colaboradorId: string;
  nome: string;
  tipo: TipoContrato;
  horasTrabalhadas?: number;
  diasTrabalhados?: number;
}

interface ConfigCLT {
  salarioMensal: number;
  cargaSemanalHoras: number; // padrão: 44h
}

interface ConfigPJ {
  modalidade: "HORA" | "DIA";
  valorHora?: number;
  valorDia?: number;
}

interface ConfigDiarista {
  valorDia: number;
}

interface ResultadoCalculo {
  nome: string;
  tipo: TipoContrato;
  valorBruto: number;
  status: "PROVISAO" | "A_PAGAR";
  detalhamento: string;
}

// ─────────────────────────────────────────────────────────────
// Calculadores por tipo
// ─────────────────────────────────────────────────────────────

function calcularCLT(ponto: RegistroPonto, config: ConfigCLT): ResultadoCalculo {
  // Premislógicaa adotada: divisor 220h para jornada CLT de 44h semanais.
  const valorHoraNormal = config.salarioMensal / 220;
  const horasTrabalhadas = ponto.horasTrabalhadas ?? 0;
  const horasNormais = Math.min(horasTrabalhadas, config.cargaSemanalHoras);
  const horasExtras = Math.max(0, horasTrabalhadas - config.cargaSemanalHoras);

  const valorNormal = horasNormais * valorHoraNormal;
  const valorExtra = horasExtras * valorHoraNormal * 1.5; // adicional de 50%

  const valorBruto = parseFloat((valorNormal + valorExtra).toFixed(2));

  return {
    nome: ponto.nome,
    tipo: "CLT",
    valorBruto,
    status: "PROVISAO", // pagamento real ocorre na folha mensal
    detalhamento: `${horasNormais}h normais × R$${valorHoraNormal.toFixed(2)} + ${horasExtras}h extras × R$${(valorHoraNormal * 1.5).toFixed(2)}`,
  };
}

function calcularPJ(ponto: RegistroPonto, config: ConfigPJ): ResultadoCalculo {
  let valorBruto = 0;
  let detalhamento = "";

  if (config.modalidade === "HORA" && config.valorHora) {
    valorBruto = (ponto.horasTrabalhadas ?? 0) * config.valorHora;
    detalhamento = `${ponto.horasTrabalhadas}h × R$${config.valorHora.toFixed(2)}/h`;
  } else if (config.modalidade === "DIA" && config.valorDia) {
    valorBruto = (ponto.diasTrabalhados ?? 0) * config.valorDia;
    detalhamento = `${ponto.diasTrabalhados} dias × R$${config.valorDia.toFixed(2)}/dia`;
  }

  return {
    nome: ponto.nome,
    tipo: "PJ",
    valorBruto: parseFloat(valorBruto.toFixed(2)),
    status: "A_PAGAR", // direcionado à emissão de nota fiscal
    detalhamento,
  };
}

function calcularDiarista(ponto: RegistroPonto, config: ConfigDiarista): ResultadoCalculo {
  const valorBruto = (ponto.diasTrabalhados ?? 0) * config.valorDia;

  return {
    nome: ponto.nome,
    tipo: "DIARISTA",
    valorBruto: parseFloat(valorBruto.toFixed(2)),
    status: "A_PAGAR",
    detalhamento: `${ponto.diasTrabalhados} dias × R$${config.valorDia.toFixed(2)}/dia`,
  };
}

// ─────────────────────────────────────────────────────────────
// Orquestrador principal
// ─────────────────────────────────────────────────────────────

function calcularFechamentoSemanal(
  registros: RegistroPonto[],
  configs: Map<string, ConfigCLT | ConfigPJ | ConfigDiarista>
): ResultadoCalculo[] {
  return registros.map((ponto) => {
    const config = configs.get(ponto.colaboradorId);
    if (!config) throw new Error(`Configuração não encontrada: ${ponto.nome}`);

    switch (ponto.tipo) {
      case "CLT":      return calcularCLT(ponto, config as ConfigCLT);
      case "PJ":       return calcularPJ(ponto, config as ConfigPJ);
      case "DIARISTA": return calcularDiarista(ponto, config as ConfigDiarista);
      default:         throw new Error(`Tipo desconhecido: ${ponto.tipo}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Dados do desafio
// ─────────────────────────────────────────────────────────────

const registrosSemana: RegistroPonto[] = [
  { colaboradorId: "joao-01", nome: "João",  tipo: "CLT",      horasTrabalhadas: 49 },
  { colaboradorId: "maria-01", nome: "Maria", tipo: "PJ",       horasTrabalhadas: 40 },
  { colaboradorId: "jose-01",  nome: "José",  tipo: "DIARISTA", diasTrabalhados: 3   },
];

const configs = new Map<string, ConfigCLT | ConfigPJ | ConfigDiarista>([
  ["joao-01",  { salarioMensal: 2200, cargaSemanalHoras: 44 }],
  ["maria-01", { modalidade: "HORA", valorHora: 50 }],
  ["jose-01",  { valorDia: 150 }],
]);

const resultados = calcularFechamentoSemanal(registrosSemana, configs);
console.table(resultados.map((r) => ({
  Nome:          r.nome,
  Tipo:          r.tipo,
  "Valor Bruto": `R$ ${r.valorBruto.toFixed(2)}`,
  Status:        r.status,
  Detalhamento:  r.detalhamento,
})));
```

---

### Saída esperada

| Nome  | Tipo     | Valor Bruto   | Status   | Detalhamento                                      |
|-------|----------|---------------|----------|---------------------------------------------------|
| João  | CLT      | R$ 515,00     | PROVISAO | 44h normais × R$10,00 + 5h extras × R$15,00      |
| Maria | PJ       | R$ 2.000,00   | A_PAGAR  | 40h × R$50,00/h                                   |
| José  | Diarista | R$ 450,00     | A_PAGAR  | 3 dias × R$150,00/dia                             |

> **Nota — João (CLT):** o valor de R$ 515,00 é uma provisão semanal para o fluxo de caixa do financeiro. O pagamento real ocorre no fechamento mensal da folha apos aplicação dos descontos legais obrigatórios sobre o total bruto acumulado no mês.#   s i s t e m a - p o n t o  
 