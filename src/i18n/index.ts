import enUS from './en-US';
import ptBR from './pt-BR';

const messages = {
  'en-US': enUS,
  'pt-BR': ptBR,
};

export type MessageLanguages = keyof typeof messages;
export type MessageSchema = typeof enUS;

export default messages;
