# Entrada e preferências — etapa 04

**Estado:** implementação revisada somente por análise estática manual. Não houve execução da aplicação, testes, lint, build, typecheck ou verificação visual. Compatibilidade de hardware e interação permanecem sem confirmação do desenvolvedor.

## Uso na interface

A página **Dispositivos** permite escolher um perfil salvo, mapear ações e observar entradas. O perfil inicial de teclado usa `KeyA`, `KeyS`, `KeyD`, `KeyF` e `KeyG` para G/R/Y/B/O, `ArrowUp`/`ArrowDown` para strum e `Escape` para pausa. São códigos físicos de tecla; a letra impressa pode variar com o layout do teclado.

Para Gamepad, a pessoa seleciona explicitamente uma conexão e cria ou abre um perfil correspondente. Não há mapeamento universal presumido para guitarras ou controles convencionais. A descoberta acompanha dispositivos enquanto a página está aberta; pode ser necessário pressionar um botão no controle para que o navegador o exponha. A API pode estar indisponível ou bloqueada; a página informa essa condição e mantém o teclado disponível. Referência: [especificação Gamepad do W3C](https://www.w3.org/TR/gamepad/).

O assistente permite atribuir cada fret, strum para cima/baixo ou sem direção e pausa. Ao escolher **Mapear**, solte os controles e acione o desejado; o primeiro controle observado é atribuído. Atribuições conflitantes são rejeitadas, preservando o rascunho anterior. Strum sem direção e strums direcionais são alternativas explícitas. Mapear uma delas remove a alternativa anterior. Para salvar, são necessários cinco frets, ao menos uma ação de strum e pausa.

**Observar entradas** inicia a captura na área focável. Frets mostram número, letra, cor e estado pressionado/solto; strums têm contagem e última direção. O monitor não avalia desempenho musical. Tab sai da captura; o botão de parada fica fora dela. A captura é encerrada ao sair dessa área, perder foco, ocultar a página ou desconectar o dispositivo. Retomar exige outra ação de início. No teclado, solte e pressione novamente teclas mantidas antes do início da captura: o navegador não fornece uma consulta global de teclas já pressionadas.

As alterações e capacidades observadas são um rascunho até **Salvar perfil**. Trocar perfil ou sair da página descarta alterações não salvas. Salvar gera uma versão nova e invalida referências de calibração do perfil editado; snapshots já existentes continuam com suas próprias cópias.

## Capacidades observáveis

- Direção de strum decorre das ações distintas mapeadas. Uma ação sem direção produz `unknown`; não comprova alternância.
- Acordes confirmados são apenas máscaras efetivamente observadas. O máximo de frets simultâneos continua desconhecido quando só há evidência de combinações bem-sucedidas; detectar três frets não prova que quatro sejam impossíveis. Uma combinação maior que um limite previamente declarado invalida esse limite.
- Controles físicos adicionais observados e não mapeados têm seus identificadores registrados, até 64. Isso não atribui mão, dedo ou função física a um botão.
- Remapear limpa capacidades observadas do rascunho, pois a relação entre controle físico e fret mudou. O assistente também mostra a distinção entre capacidades ainda desconhecidas e strum não mapeado.

## Contrato dos adaptadores

`src/platform/input/contracts.ts` define disponibilidade, início, modo, limpeza, parada e descarte. `BrowserInputAdapter` possui caminhos de captura para teclado e Gamepad e uma única saída `NormalizedInputEvent`. Apenas uma instância pode capturar por vez. Iniciar outra interrompe a anterior com `context-changed`.

O teclado usa `KeyboardEvent.code`, ignora repetição automática e atalhos com Ctrl/Alt/Meta, e mantém um conjunto de teclas para distinguir bordas reais. Tab e as teclas desses modificadores não podem ser mapeados. Só eventos originados dentro do escopo configurado podem iniciar ações; campos editáveis não são consumidos. O escopo da página de dispositivos é uma área própria, sem formulários. Referência: [UI Events do W3C](https://www.w3.org/TR/uievents/).

Gamepad consulta a conexão selecionada a cada frame, compara valores com o estado anterior e suporta botões e ambos os sentidos dos eixos. O assistente cria limiares de acionamento `0.6` e liberação `0.3`; o contrato aceita os valores validados do perfil, com `0 <= release < press <= 1`. Valores na faixa intermediária preservam o estado anterior. Strum só ocorre na borda e precisa de liberação; eixos precisam de uma observação no neutro antes de outro ataque, inclusive ao trocar de sentido. A primeira amostra sincroniza frets e bloqueia ataques de controles já mantidos.

A conexão inclui um identificador transitório independente do índice de Gamepad. Desconexões observadas invalidam sua seleção, mesmo se o navegador reutilizar o índice. O ID de hardware reportado identifica um modelo/descrição e não é tratado como número de série. O adaptador não inventa transições ocorridas entre amostras; uma troca indistinguível que o navegador não reporte também não pode ser reconstruída.

Na mesma amostra, atualizam-se todos os frets e emitem-se as bordas de strum na ordem dos bindings. Só o primeiro evento inclui máscaras pressionadas/liberadas; os demais usam zero. Pausa tem prioridade e não emite releases sintéticos ou strums daquele lote. A limpeza sincroniza a máscara por `onBaseline`, separado dos eventos de gameplay.

Na entrega original da etapa 04, todos os timestamps usavam **instante de observação**, com `timeSource: 'observation'`. A interface de inspeção conserva esse comportamento e usa tempo decorrido desde o início da captura. A etapa 05 ampliou `InputTimeline.sample` para receber também o timestamp do dispositivo e devolver tempo ativo bruto com a fonte escolhida. `createSessionInput` usa `SessionInputTimeline` por padrão, com fallback para observação; nenhum offset é aplicado pelo adaptador. As conversões estão descritas em [relógio e calibração](./timing-and-calibration.md).

`createSessionInput` liga o contrato à `TrainingSession`, usando o dispositivo do snapshot. Antes de iniciar sua captura, a sessão deve estar em `ready`, `countdown` ou `paused`. Durante preparação/contagem/pausa, frets são sincronizados sem consumir sequência de gameplay; apenas `running` grava eventos. A sequência é preservada ao parar/retomar a instância e pode continuar a partir do último evento da sessão quando um adaptador é substituído. O relógio fornecido deve preservar o horizonte bruto e excluir pausas.

O vínculo encaminha interrupções para pausa e mudança de contexto para abandono. Não retoma a sessão automaticamente. O futuro coordenador deve entregar entradas antes de avançar o horizonte, cancelar áudio/julgamento durante interrupções, encerrar a tentativa antes de alterar condições e descartar o adaptador ao concluir/sair. A interface jogável que será proprietária desse vínculo permanece na etapa 07; esta etapa não inicia exercícios nem produz métricas.

`stop` remove listeners e cancela o próximo frame, limpando estados transitórios sem apagar a sequência. `dispose` faz a mesma limpeza e impede novo início. O componente descarta a captura, a descoberta e seu intervalo de atualização ao sair da rota. Não existem listeners de captura na página de configurações ou no catálogo.

## Repositório pequeno e versionado

`src/platform/preferences/repository.ts` usa a chave `fretsense.preferences.v1`, com `schemaVersion: 1`. Guarda idioma, tema, redução de efeitos, até 16 perfis e ID do perfil selecionado. A conexão física selecionada é transitória e precisa ser escolhida novamente; a busca no catálogo continua em memória durante a visita. Histórico e eventos de sessões não são gravados nesse repositório.

Leitura valida tamanho máximo de 262.144 unidades de texto, esquema, perfis, referências selecionadas e duplicação de IDs. Cada perfil mantém os limites do núcleo. Dados inválidos ou de versão desconhecida são preservados sem sobrescrita automática; a visita usa padrões em memória e exibe o aviso. Migração/importação de dados desconhecidos não faz parte desta etapa.

Falha de acesso ou gravação mantém alterações em memória e informa que não foram salvas. **Tentar salvar novamente** reaplica o estado atual quando o armazenamento voltar a funcionar. Não há alegação de persistência bem-sucedida após uma exceção. O estado `incompatible` bloqueia gravações sobre o valor original, inclusive pela ação de tentativa de gravação.

`useInterfaceStore` carrega os dados validados; `App.vue` persiste mudanças de idioma/tema/redução de efeitos e continua aplicando tradução, tema e acessibilidade. `StorageNotice` apresenta o estado na página de dispositivos e nas configurações. Não há sincronização entre abas: uma gravação posterior de outra aba pode substituir preferências anteriores.

## Próxima integração

A etapa 05 implementou relógio ativo da plataforma, áudio e calibração. A etapa 06 fornecerá o julgador, e a etapa 07 conectará esses componentes à área jogável. A existência dos adaptadores não confirma latência, combinações suportadas por um teclado específico ou compatibilidade de um modelo de guitarra; essas confirmações dependem do desenvolvedor e do hardware utilizado.
