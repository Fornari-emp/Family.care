/** Mensagens amigáveis para cada erro do domínio (item 26). */
import type { EngineError } from '@/domain/engine';
import { formatBRL } from '@/domain/money';
import { MAX_BACKDATE_DAYS, MIN_AMOUNT_CENTS } from '@/domain/rewards';

const MESSAGES: Record<EngineError, string> = {
  'below-min': `O valor mínimo é ${formatBRL(MIN_AMOUNT_CENTS)}.`,
  'above-max': 'Valor acima do máximo configurado no seu perfil.',
  'needs-confirmation': 'Confirme o valor alto antes de registrar.',
  'invalid-date': 'Data inválida.',
  'future-date': 'Não dá para registrar com data no futuro.',
  'too-old': `Só é possível registrar até ${MAX_BACKDATE_DAYS} dias atrás.`,
  'not-found': 'Item não encontrado.',
  'not-complete': 'Essa missão ainda não foi concluída.',
  'already-claimed': 'Essa recompensa já foi resgatada.',
  'not-reached': 'Você ainda não alcançou essa meta.',
  'invalid-name': 'Dê um nome de 1 a 40 caracteres.',
  'invalid-target': 'O valor da meta deve ser de pelo menos R$ 1,00.',
  'invalid-deadline': 'O prazo precisa ser hoje ou depois.',
  'too-many-goals': 'Você atingiu o limite de metas personalizadas.',
  'not-custom': 'Metas padrão não podem ser alteradas.',
  'already-owned': 'Você já tem esse item.',
  'not-owned': 'Compre o item antes de equipar.',
  'insufficient-coins': 'Moedas insuficientes.',
  'freeze-limit': 'Você já guarda o máximo de 2 congelamentos.',
  'cannot-unequip-suit': 'O personagem precisa de um terno.',
  'entry-not-found': 'Registro não encontrado.',
  'negative-balance': 'Isso deixaria o saldo da categoria negativo. Confira os resgates.',
  'invalid-note': 'A observação pode ter até 80 caracteres.',
  'invalid-category': 'Escolha uma categoria.',
  'chest-already-opened': 'Você já abriu o baú hoje.',
  'invalid-confirmation': 'Digite REINICIAR para confirmar.',
  'invalid-nickname': 'O apelido precisa ter de 1 a 20 caracteres.',
  'invalid-timezone': 'Fuso horário inválido.',
  'invalid-profile': 'Configuração inválida.',
};

export function errorMessage(error: EngineError): string {
  return MESSAGES[error];
}
