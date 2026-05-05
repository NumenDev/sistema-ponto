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
// Calculadores por tipo (Strategy)
// ─────────────────────────────────────────────────────────────

function calcularCLT(ponto: RegistroPonto, config: ConfigCLT): ResultadoCalculo {
  // Premissa adotada: divisor 220h para jornada CLT de 44h semanais.
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
    status: "PROVISAO", // pagamento real ocorre na folha mensal com INSS/IRRF/FGTS
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
    status: "A_PAGAR", // condicionado à emissão de nota fiscal
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
// Dados do problema
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