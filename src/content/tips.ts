/**
 * Dicas do dia: conteúdo educacional geral. Nenhuma dica recomenda um ativo específico
 * nem diz em que investir (item 19).
 */
import { daysBetween, type DayKey } from '@/domain/dates';

export interface Tip {
  id: string;
  title: string;
  body: string;
}

export const TIPS: readonly Tip[] = [
  {
    id: 't01',
    title: 'Reserva de emergência primeiro',
    body: 'Antes de buscar rentabilidade, muita gente monta uma reserva para imprevistos, guardada onde dá para sacar rápido e com baixo risco. Um valor de referência comum é de 3 a 6 meses de gastos essenciais.',
  },
  {
    id: 't02',
    title: 'Constância vence o valor',
    body: 'Aportar um pouco todo mês costuma fazer mais diferença no longo prazo do que um aporte grande e isolado. O hábito é o que sustenta o patrimônio.',
  },
  {
    id: 't03',
    title: 'Juros compostos',
    body: 'Nos juros compostos, o rendimento de hoje passa a render amanhã. Por isso o tempo é um aliado: quanto antes o dinheiro começa a trabalhar, maior o efeito.',
  },
  {
    id: 't04',
    title: 'Liquidez',
    body: 'Liquidez é a facilidade de transformar um investimento em dinheiro disponível. Verifique sempre o prazo de resgate antes de aplicar um dinheiro que você pode precisar logo.',
  },
  {
    id: 't05',
    title: 'Risco e retorno andam juntos',
    body: 'Promessas de retorno alto com risco baixo merecem desconfiança. Em geral, quanto maior o retorno esperado, maior a chance de oscilações e perdas.',
  },
  {
    id: 't06',
    title: 'O que é o CDI',
    body: 'O CDI é uma taxa de referência usada por muitos investimentos de renda fixa. Quando você lê "100% do CDI", o rendimento acompanha essa taxa ao longo do tempo.',
  },
  {
    id: 't07',
    title: 'O que é a Selic',
    body: 'A Selic é a taxa básica de juros da economia, definida pelo Banco Central. Ela influencia o rendimento da renda fixa e o custo do crédito.',
  },
  {
    id: 't08',
    title: 'Inflação corrói o dinheiro parado',
    body: 'Se o seu dinheiro rende menos que a inflação, ele perde poder de compra. Compare rendimentos sempre descontando a inflação do período.',
  },
  {
    id: 't09',
    title: 'Garantia do FGC',
    body: 'Alguns investimentos bancários contam com a garantia do Fundo Garantidor de Créditos, até um limite por CPF e por instituição. Confira as regras e os limites atualizados no site do FGC.',
  },
  {
    id: 't10',
    title: 'Imposto de renda regressivo',
    body: 'Em muitos investimentos de renda fixa, a alíquota de IR diminui quanto mais tempo o dinheiro fica aplicado. Considere o prazo ao comparar opções.',
  },
  {
    id: 't11',
    title: 'Taxas importam',
    body: 'Taxas de administração, custódia e corretagem parecem pequenas, mas se acumulam ao longo dos anos. Leia a lâmina ou o regulamento e compare custos.',
  },
  {
    id: 't12',
    title: 'Diversificar é proteger',
    body: 'Diversificar é distribuir o dinheiro entre diferentes tipos de investimento para que um problema isolado não comprometa tudo.',
  },
  {
    id: 't13',
    title: 'Defina objetivos',
    body: 'Investir com um objetivo claro (prazo e valor) ajuda a escolher o tipo de aplicação e a manter a disciplina quando o mercado oscila.',
  },
  {
    id: 't14',
    title: 'Prazo combina com o objetivo',
    body: 'Dinheiro que você vai usar em meses pede aplicações de baixo risco e boa liquidez. Objetivos de muitos anos toleram mais oscilação no caminho.',
  },
  {
    id: 't15',
    title: 'Oscilação não é prejuízo realizado',
    body: 'Em investimentos de renda variável, o valor sobe e desce. A perda só se concretiza se você vender abaixo do que pagou.',
  },
  {
    id: 't16',
    title: 'Cuidado com golpes',
    body: 'Desconfie de promessas de lucro garantido, pressa para decidir e pedidos de transferência para pessoas físicas. Confira se a empresa é autorizada pela CVM ou pelo Banco Central.',
  },
  {
    id: 't17',
    title: 'Conheça seu perfil',
    body: 'As instituições aplicam um questionário de perfil de investidor (suitability). Responder com sinceridade ajuda a evitar produtos incompatíveis com você.',
  },
  {
    id: 't18',
    title: 'Pague-se primeiro',
    body: 'Uma estratégia popular é separar o valor do aporte logo que o salário cai, em vez de investir o que sobrar no fim do mês.',
  },
  {
    id: 't19',
    title: 'Dívidas caras primeiro',
    body: 'Juros de cartão de crédito e cheque especial costumam ser muito maiores que o rendimento de qualquer investimento. Quitar essas dívidas costuma ser o melhor "retorno".',
  },
  {
    id: 't20',
    title: 'Rentabilidade passada',
    body: 'Rentabilidade passada não garante rentabilidade futura. Um produto que foi bem no último ano pode ir mal no próximo.',
  },
  {
    id: 't21',
    title: 'Leia antes de investir',
    body: 'Todo produto de investimento tem documentos com regras, riscos e custos. Ler esses materiais é parte do processo, não um detalhe.',
  },
  {
    id: 't22',
    title: 'Prefixado, pós-fixado e híbrido',
    body: 'Na renda fixa, o rendimento pode ser definido na compra (prefixado), acompanhar um indicador (pós-fixado) ou combinar inflação com uma taxa (híbrido).',
  },
  {
    id: 't23',
    title: 'Marcação a mercado',
    body: 'Alguns títulos de renda fixa mudam de preço todo dia conforme os juros. Vender antes do vencimento pode dar ganho ou perda em relação ao combinado.',
  },
  {
    id: 't24',
    title: 'Registre tudo',
    body: 'Anotar cada aporte e resgate ajuda a enxergar sua evolução real e facilita a declaração do imposto de renda.',
  },
  {
    id: 't25',
    title: 'Revise, mas sem ansiedade',
    body: 'Acompanhar a carteira com frequência é diferente de mexer nela o tempo todo. Revisões periódicas e planejadas tendem a gerar decisões melhores.',
  },
  {
    id: 't26',
    title: 'Rebalanceamento',
    body: 'Com o tempo, a distribuição da carteira muda. Rebalancear é voltar à divisão planejada, o que mantém o nível de risco que você escolheu.',
  },
  {
    id: 't27',
    title: 'Custo de oportunidade',
    body: 'Toda escolha tem custo de oportunidade: o dinheiro aplicado em uma opção deixa de estar em outra. Compare alternativas com o mesmo prazo e risco.',
  },
  {
    id: 't28',
    title: 'Educação financeira contínua',
    body: 'Fontes públicas como os portais de educação financeira da CVM e do Banco Central oferecem cursos e materiais gratuitos.',
  },
  {
    id: 't29',
    title: 'Comece pequeno',
    body: 'Não é preciso muito dinheiro para começar. Começar com valores pequenos ajuda a aprender sem colocar em risco o que você não pode perder.',
  },
  {
    id: 't30',
    title: 'Emoção é má conselheira',
    body: 'Medo e euforia levam a comprar caro e vender barato. Ter um plano escrito ajuda a manter a calma nos momentos de agitação.',
  },
  {
    id: 't31',
    title: 'Previdência é longo prazo',
    body: 'Planos de previdência têm regras próprias de tributação e resgate. Entenda prazos, taxas e o regime de tributação antes de contratar.',
  },
  {
    id: 't32',
    title: 'Seu ritmo é o certo',
    body: 'Compare-se com você mesmo de meses atrás, não com os outros. O importante é avançar de forma sustentável dentro do seu orçamento.',
  },
];

/** Dica do dia: rotaciona pela data, todos os usuários veem a mesma no mesmo dia. */
export function tipForDay(day: DayKey): Tip {
  const n = TIPS.length;
  const idx = ((daysBetween('2026-01-01', day) % n) + n) % n;
  return TIPS[idx] as Tip;
}
