# Orientações para agentes

## Projeto e referências

Fretsense é um treinador procedural para jogos rítmicos de cinco frets, com exercícios adaptativos e análise de desempenho no navegador. A stack atual usa Vue 3, TypeScript, Quasar com Vite, Pinia e Vue I18n.

- `README.md`: apresentação do projeto.
- `docs/fretsense-idea.md`: visão do produto, ideias e escopo proposto; não implica que tudo já esteja implementado.
- `package.json`: dependências e scripts disponíveis.
- `quasar.config.ts`: configuração da aplicação.
- `src/pages`, `src/layouts` e `src/components`: páginas, layouts e componentes.
- `src/router`, `src/stores` e `src/i18n`: rotas, estado e traduções.
- `src/css`: estilos globais e variáveis do tema.

## Forma de trabalho

- Siga os padrões existentes e mantenha as alterações focadas no pedido.
- Valide apenas por análise estática manual: leitura do código, revisão das alterações, imports, tipos e coerência da lógica.
- Não execute lint, formatação automática ou correções automáticas, incluindo `lint` e `lint:check`.
- Não crie nem execute testes de qualquer tipo.
- Não rode o projeto, servidores de desenvolvimento, previews ou verificações no navegador.
- Não execute build, typecheck (`vue-tsc`, `tsc`) ou outros comandos de validação automatizada.
- Não instale ou atualize dependências apenas para validar as alterações.
- Comandos de leitura, busca e inspeção de diferenças são permitidos.
- A análise estática manual é suficiente para a entrega. O desenvolvedor responsável irá testar e relatar eventuais erros.
- Ao concluir, resuma as alterações e informe que a validação foi feita somente por análise estática manual, sem afirmar que testes foram executados.
