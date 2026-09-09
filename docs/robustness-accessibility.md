# Robustez, desempenho e acessibilidade

Este documento registra as garantias implementadas na etapa 15B. Ele descreve comportamento esperado por análise estática; não afirma compatibilidade, latência ou desempenho medidos em execução.

## Ciclo de vida da tentativa

| Situação | Tratamento | Retomada |
| --- | --- | --- |
| Perda de foco da janela ou da área de captura | A entrada é descartada, o relógio ativo e o julgador são pausados, os frets ativos são limpos e o áudio agendado é cancelado. | Somente pelo botão **Retomar**, seguido de nova contagem. |
| Aba oculta ou evento `pagehide` | Recebe o mesmo tratamento de pausa por interrupção. Não há avanço em segundo plano nem retomada automática ao voltar. | Explícita, com nova contagem. |
| Gamepad desconectado ou controle indisponível | O polling é cancelado, a conexão deixa de ser aceita e a tentativa pausa. | Reconectar/selecionar uma conexão compatível e retomar explicitamente. |
| `AudioContext` suspenso, saída alterada ou agenda atrasada | Nós e timer do metrônomo são cancelados. Suspensão pausa a tentativa; mudança do contexto congelado encerra a tentativa como incompatível. | Suspensão exige novo gesto no botão **Retomar**; contexto diferente exige nova tentativa/calibração. |
| Mudança de rota | A tentativa ativa é encerrada como saída do usuário antes de liberar captura, frame e áudio. | Uma nova tentativa deve ser iniciada. |
| Redimensionamento | O `ResizeObserver` — ou o listener de `resize` usado como fallback — redimensiona apenas o backend Canvas e invalida seu fundo em cache. | Não reinicia ou avança o julgamento. |

A pausa chama o horizonte de julgamento uma única vez até o instante observado e depois desarma HOPO, limpa baseline e congela sustains. O tempo de pausa não expira notas. A retomada nunca é automática e sempre cria outro adaptador de entrada, confirma disponibilidade e executa uma nova contagem. Interrupções tornam a tentativa inelegível para progressão automática, mas preservam o resultado.

## Recursos e trabalho limitado

- O adaptador de teclado remove `keydown`, `keyup`, foco e visibilidade no descarte. O adaptador de Gamepad também cancela seu `requestAnimationFrame` e o listener de desconexão.
- A descoberta de Gamepads usa um único intervalo de um segundo, não consulta dispositivos com a aba oculta e remove intervalo/listener ao desmontar.
- O coordenador mantém no máximo um frame de sessão. O renderer usa busca binária e desenha apenas notas e marcadores no trecho visível; fundo, estilos e efeitos usam caches/buffers limitados.
- O metrônomo agenda somente 120 ms à frente, aceita no máximo 16 nós simultâneos e cancela intervalos, osciladores, ganhos e listeners ao parar/descartar.
- Preferências visuais/de interface são coalescidas e gravadas em uma tarefa posterior, com flush em `pagehide`; uma mudança de controle não faz `localStorage` síncrono no mesmo handler.
- O histórico recebe a persistência depois do frame final. IndexedDB é assíncrono, mantém uma conexão por ciclo da aplicação e a fecha em `versionchange`; falhas preservam a sessão em memória.
- Julgamentos são transferidos incrementalmente para a interface. Snapshots completos de entradas/julgamentos só são criados ao finalizar, persistir ou exportar; análise detalhada ocorre entre blocos, depois do fechamento musical.
- Nenhum `Worker` ou conexão remota existe nesta versão. Os limites atuais mantêm a análise local delimitada; um Worker só deve ser introduzido com medição do desenvolvedor que demonstre bloqueio relevante.

## Limites e recuperação

| Recurso | Limite atual | Recuperação |
| --- | ---: | --- |
| Duração ativa | 600.000 ms (10 min) | A configuração permanece editável e orienta reduzir duração/repetições/densidade. |
| Chart | 4.096 notas; 1.440.000 ticks | Geração é recusada antes de ultrapassar o buffer. |
| Padrão / repetições | 128 passos / 128 blocos | Validação aponta o campo fora do limite. |
| Entrada / julgamentos | 65.536 / 131.072 eventos | A tentativa encerra com `resource-limit`; dados parciais não habilitam progressão. |
| Interrupções | 64 | A tentativa encerra com `resource-limit`. |
| Análise | 2.100.000 células de alinhamento; 512 trechos; 64 evidências por diagnóstico | O relatório marca análise parcial e conserva métricas disponíveis. |
| Retenção detalhada | 2.048 entradas, 2.048 julgamentos e 2 MB serializados | Salva resumo e identifica `retention-limit`; não finge que os eventos foram mantidos. |
| Metrônomo | 4.096 beats por agenda e 16 nós simultâneos | Agenda inválida/atrasada é cancelada e pausa a tentativa. |

O formulário limita dinamicamente a duração musical a no máximo dez minutos para o BPM informado. Configurações importadas continuam protegidas pelos validadores canônicos e não são truncadas silenciosamente.

## Acessibilidade

- Toda ação essencial tem controle textual e foco visível; botões e seletores dentro da captura não são interpretados como gameplay quando usados pelo teclado.
- As cinco pistas são distinguidas por posição, número, letra e nome, além de cor. O modo de alto contraste também escreve a letra do fret nas notas.
- Perda de foco leva o foco ao botão de retomada; conclusão leva o foco ao título do resultado. O estado da sessão, tela cheia e ações de diagnóstico usam anúncios pontuais.
- Feedback de cada nota e números da contagem permanecem visuais, sem `aria-live`, evitando uma fila de anúncios durante o ritmo. O resumo final oferece as métricas acessíveis em texto.
- Preferência do sistema/usuário por movimento reduzido, intensidade de efeitos e alto contraste podem mudar durante a tentativa. Essas mudanças são cosméticas: scroll visual congelado, BPM, relógio e julgamento não mudam.
- O teclado e os perfis de Gamepad são remapeáveis. O monitor de entrada expõe o que o navegador observou sem inferir mão, dedo ou transições perdidas entre amostras.

## Diagnóstico local opcional

Em uma tentativa pausada ou concluída, **Diagnóstico local para suporte** permite copiar ou baixar JSON com versão do aplicativo, IDs e versões dos perfis, sessão, semente, chart, contagens, calibração, preferências visuais congeladas/atuais, estado de armazenamento e capacidades detectáveis do navegador. O conteúdo só é montado por essa ação e não é enviado automaticamente. O identificador de hardware bruto não é incluído. Preferências cosméticas alteradas durante a execução não reescrevem o snapshot comparável; o diagnóstico registra separadamente o valor atual.

## Capacidades esperadas e confirmação

| Área | Capacidade esperada nesta implementação | Compatibilidade confirmada pelo desenvolvedor |
| --- | --- | --- |
| Teclado | `KeyboardEvent.code`, foco programático e timestamps convertíveis na mesma linha monotônica. | Não confirmada por navegador/versão. |
| Gamepad | `navigator.getGamepads`, botões/eixos até índice 255, polling por frame e evento de desconexão. Requer contexto em que a API esteja exposta. | Não confirmada por navegador, controle ou adaptador. |
| Áudio | Web Audio com `AudioContext`, retomada por gesto e osciladores locais. Seleção de saída não é oferecida; mudança detectável invalida a calibração. | Não confirmada por navegador/dispositivo de áudio. |
| Renderização | Canvas 2D, `ResizeObserver` com fallback pelo evento de resize da janela, densidade de pixels limitada a 2,5 e tela cheia quando `requestFullscreen` existe. A tentativa é bloqueada quando Canvas 2D não está disponível. | Movimento e estilo foram observados pelo desenvolvedor na etapa 15A; desempenho, resize, contraste e tela cheia desta revisão não foram confirmados. |
| Armazenamento | `localStorage` para preferências/calibrações e IndexedDB para sessões/recomendações, com fallback em memória. | Não confirmado por navegador, modo privado ou política de armazenamento. |

WebHID, instalação PWA/offline, perfis de edições externas e coleta remota não fazem parte desta etapa. O retorno anterior do desenvolvedor sobre notas estáticas, sensação de zoom e efeitos de hits/sustains foi incorporado na etapa 15A e preservado nesta revisão; não há nova evidência de execução para ajustar limites ou declarar metas de desempenho.
