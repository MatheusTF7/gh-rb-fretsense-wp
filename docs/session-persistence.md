# Persistência e histórico de sessões

**Versão do banco:** `fretsense-sessions` / esquema IndexedDB 1  
**Versão do registro e da exportação:** 1

## Fronteiras

Preferências de interface, perfis de entrada e calibrações continuam nos repositórios pequenos e versionados baseados em `localStorage`. Tentativas usam IndexedDB e dois object stores: `sessions`, para o registro completo, e `session-summaries`, para listagem sem carregar charts e eventos de todas as tentativas.

O contrato `SessionRepository` não depende da implementação IndexedDB. A implementação mantém um espelho em memória das tentativas produzidas durante a visita. Se IndexedDB estiver ausente, bloqueado, sem cota ou falhar ao abrir/gravar, a gameplay não é interrompida: o resultado continua acessível na visita e a interface informa que ele não foi salvo de forma persistente.

## Conteúdo preservado

Cada registro usa o ID da tentativa como chave idempotente e contém:

- snapshot, configuração e chart efetivamente realizadas;
- referências do gerador e das regras;
- perfil do dispositivo com suas capacidades e calibração congelada;
- métricas, diagnóstico, interrupções, elegibilidade e estado final;
- campos explícitos para apresentação e edição de jogo, atualmente `null`, pois esses perfis só serão definidos nas etapas 15A e 19;
- contagens e, quando elegíveis, eventos normalizados de entrada e julgamento.

Uma segunda gravação idêntica para o mesmo ID não altera o registro. Dados diferentes com o mesmo ID causam conflito e o registro persistente existente não é sobrescrito.

## Retenção e replay

São retidos no máximo 2.048 eventos de entrada, 2.048 eventos de julgamento e 2 MB serializados por tentativa. Se a origem já estiver incompleta ou qualquer limite for excedido, os eventos brutos não são salvos: permanecem o snapshot, a chart, o resultado, a análise agregada e as contagens originais. A tela de resultado identifica o caso como “somente resumo”.

Recriar o exercício significa usar a chart e a configuração congeladas. Reproduzir a execução exigiria a sequência completa de eventos; essa reprodução não está implementada e não é apresentada como disponível. A exportação JSON informa se os eventos necessários foram retidos.

## Compatibilidade e migração

A migração inicial cria os dois object stores ao passar do banco inexistente (versão 0) para o esquema 1. Abertura com versão incompatível, migração bloqueada e registros com envelope não reconhecido não provocam limpeza automática. Registros incompatíveis permanecem no banco, são omitidos das consultas tipadas e aparecem como uma limitação no histórico.

Não há importação de backup nesta etapa. Uma futura importação deve validar versão, estrutura e tamanho antes de gravar qualquer dado.

## Consulta, exportação e remoção

O histórico oferece filtros básicos por técnica, modo e estado final, seguidos de paginação. O detalhe é carregado pelo ID da rota. A exportação produz um arquivo JSON com produto, versão do esquema, data de exportação e registro completo. A remoção ocorre somente após confirmação explícita e apaga o detalhe e seu resumo na mesma transação quando o banco persistente está disponível.

## Limites da revisão

Esta implementação foi revisada somente por análise estática manual. Disponibilidade, cota, migrações, persistência entre recargas e downloads dependem de confirmação em execução pelo desenvolvedor.
