# Plano de importação RB3CON e biblioteca musical local

**Estado:** proposta de implementação; nenhum item deste plano está implementado.
**Objetivo:** acrescentar ao Fretsense um modo de música completa no qual a pessoa importa conteúdo RB3CON do próprio dispositivo, mantém uma biblioteca privada no navegador e executa uma chart de cinco frets sincronizada ao áudio.
**Escopo inicial recomendado:** pacotes RB3CON de uma música, guitarra de cinco frets, dificuldade Expert e áudio MOGG não criptografado em uma variante confirmada como decodificável nos navegadores-alvo.
**Referências internas:** [plano geral](./fretsense-development-plan.md), [núcleo do motor](./engine-foundation.md), [regras de gameplay](./gameplay-rules.md), [relógio e calibração](./timing-and-calibration.md), [persistência de sessões](./session-persistence.md) e [entrega 0.0.1](./release-0.0.1.md).

## 1. Decisão de produto e limites

O conteúdo procedural continua sendo uma modalidade própria. A importação não deve transformar uma música em `DrillConfig`, sim introduzir uma segunda origem de conteúdo explicitamente identificada em configuração, snapshot, resultado e relatório:

```ts
type SessionContent =
  | { readonly kind: 'drill'; readonly config: DrillConfig; readonly chart: ProceduralChart }
  | { readonly kind: 'song'; readonly config: SongPlayConfig; readonly chart: ImportedChart };
```

Uma primeira entrega deve permitir:

1. selecionar um arquivo RB3CON por ação explícita;
2. inspecionar e validar o pacote sem executar conteúdo dele;
3. mostrar título, artista e as partes/dificuldades encontradas;
4. salvar localmente uma música aceita;
5. abrir a música a partir de uma biblioteca;
6. selecionar guitarra e Expert;
7. tocar a chart sincronizada ao áudio;
8. salvar o resultado no histórico existente;
9. excluir a música sem excluir tentativas anteriores.

Não fazem parte do primeiro incremento:

- download, catálogo remoto, compartilhamento ou envio de arquivos;
- conteúdo oficial protegido ou contorno de criptografia/DRM;
- packs com várias músicas, ainda que o formato possa contê-los;
- bass, drums, vocals, keys, pro guitar ou pro bass;
- dificuldades Easy, Medium e Hard;
- stems reativos, redução do instrumento ao errar ou mixagem avançada;
- overdrive, estrelas, score e multiplicador equivalentes a Rock Band/Guitar Hero;
- solos, Big Rock Endings, prática por seção ou alteração da velocidade da música;
- fidelidade declarada às regras de uma edição específica de jogo;
- sincronização entre navegadores, conta, nuvem ou garantia de backup.

O modo inicial pode usar o perfil de julgamento autoral `fretsense-v1`, desde que a interface o identifique assim. Equivalência com RB3 ou uma edição de Guitar Hero depende de estudo e de um `GameEditionProfile` próprio, conforme a etapa 19 do plano geral.

## 2. Leitura do ponto de partida

### 2.1 Recursos que podem ser reutilizados

| Área atual | Aproveitamento no modo de música |
| --- | --- |
| `src/rendering` e `TrainingHighway.vue` | Canvas, projeção, culling, notas, acordes, HOPO, tap, sustains e feedback visual |
| `TrainingSession` | estados, contagem, pausa, retomada, encerramento e buffers limitados |
| `InitialJudge` | primeiro julgamento musical, depois de desacoplado de charts exclusivamente geradas |
| entrada de teclado/Gamepad | formato normalizado e mapeamento de cinco frets/strum |
| calibração | offsets visual e de julgamento, preservando aplicação única |
| relatórios e histórico | resultado por tentativa, desde que a origem `song` seja registrada e comparada corretamente |
| IndexedDB existente | padrões de repositório, migração, estados de falha e fallback em memória para resultados |

### 2.2 Restrições que exigem mudança

| Restrição atual | Mudança necessária |
| --- | --- |
| `Chart` tem `bpm` único e resolução fixa de 480 TPQ | representar resolução do MIDI, mapa de tempo e compassos |
| conversão tick/tempo usa uma única fórmula | converter por segmentos de tempo e compilar instantes absolutos das notas |
| `ChartNote.origin` exige padrão, técnica e repetição | usar origem discriminada procedural/importada |
| `SessionPreparation` recebe somente `DrillConfig` | receber uma preparação discriminada por origem |
| `createSessionSnapshot` sempre chama `generateDrill` | validar chart importada sem tentar regenerá-la |
| repetição e variação pressupõem semente | repetir música preserva revisão; variar não se aplica |
| `SessionAudio` agenda somente metrônomo | criar transporte de áudio musical com pausa, seek e retomada |
| análise/adaptação agrupam por técnica, nível e BPM | distinguir tentativas de música e não recomendar progressão procedural automaticamente |
| limite de 4.096 notas e 10 minutos é comum ao gerador | criar limites explícitos para importação, música e recursos binários |

O renderer não deve interpretar MIDI, DTA ou STFS. Ele continuará recebendo apenas uma chart normalizada e instantes visuais.

## 3. Formato de entrada e política de compatibilidade

RB3CON é o contêiner de distribuição, não o modelo interno do Fretsense. O importador deve localizar, pelo manifesto do pacote e por `songs.dta`, os recursos necessários:

- DTA para identidade, metadados, caminhos e disposição de canais;
- MIDI para resolução temporal, tempos, compassos, partes, dificuldades, notas e marcadores;
- MOGG para o áudio;
- arte da capa quando a variante encontrada for suportada;
- outros recursos apenas como itens ignorados conhecidos.

Cada importação deve produzir um relatório de compatibilidade antes de gravar:

| Estado | Significado |
| --- | --- |
| `supported` | todos os recursos exigidos foram reconhecidos e podem ser executados |
| `supported-with-ignored-features` | guitarra Expert e áudio são utilizáveis, mas há recursos fora do escopo |
| `unsupported-audio` | chart reconhecida, porém MOGG não pode ser decodificado com segurança |
| `unsupported-package` | estrutura STFS, pack ou variante não atendida |
| `invalid-content` | referências, MIDI, notas, tamanhos ou metadados violam os contratos |
| `resource-limit` | conteúdo válido em estrutura, mas excede limites locais declarados |

O parser DTA deve aceitar apenas a gramática necessária e nunca usar `eval`, `Function` ou execução de scripts. Caminhos internos precisam ser normalizados e impedidos de escapar da raiz lógica do pacote. Nomes vindos do arquivo são dados de exibição, nunca caminhos locais ou HTML confiável.

Antes de escolher ou portar bibliotecas, registrar licença, manutenção, tamanho de bundle, suporte a Worker e preservação dos eventos MIDI necessários. O Onyx é uma referência funcional útil, mas seu código GPL não deve ser copiado sem uma decisão explícita de compatibilidade de licença.

## 4. Arquitetura de destino

### 4.1 Modelo da música importada

O registro canônico deve separar a música, suas charts selecionáveis e os assets binários:

```ts
interface ImportedSongRecord {
  readonly schemaVersion: 1;
  readonly id: string; // derivado de identidade interna + hash do conteúdo
  readonly revisionHash: string; // SHA-256 dos bytes de origem relevantes
  readonly importedAtIso: string;
  readonly source: {
    readonly format: 'rb3con';
    readonly originalFileName: string;
    readonly packageKind: 'single-song';
    readonly importer: VersionedReference;
  };
  readonly metadata: SongMetadata;
  readonly availableParts: readonly ImportedPartSummary[];
  readonly assets: SongAssetManifest;
}

interface ImportedChart {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly songId: string;
  readonly songRevisionHash: string;
  readonly instrument: 'guitar';
  readonly difficulty: 'expert';
  readonly timeline: ChartTimeline;
  readonly notes: readonly ImportedChartNote[];
  readonly sections: readonly ChartSection[];
  readonly source: VersionedReference;
}
```

IDs de música não devem depender somente de título/artista ou do `song_id` declarado, pois pacotes distintos podem reutilizá-los. O hash identifica os bytes importados; uma identidade lógica separada permite, futuramente, apresentar revisões da mesma música sem sobrescrever silenciosamente a anterior.

### 4.2 Timeline musical

```ts
interface ChartTimeline {
  readonly ticksPerQuarter: number;
  readonly lengthTicks: number;
  readonly tempoEvents: readonly {
    readonly tick: number;
    readonly microsecondsPerQuarter: number;
  }[];
  readonly timeSignatures: readonly {
    readonly tick: number;
    readonly numerator: number;
    readonly denominator: number;
  }[];
}
```

Na importação, a timeline é validada e compilada em segmentos cumulativos. Cada nota recebe `timeMs` e `endTimeMs` derivados desse índice. Julgamento e áudio trabalham em milissegundos; ticks continuam servindo para identidade musical, grade, compassos, seções e relatórios.

Invariantes mínimas:

- TPQ inteiro positivo dentro de limite documentado;
- primeiro segmento de tempo efetivo em tick zero, inserindo padrão somente quando a especificação permitir;
- eventos ordenados de forma canônica e sem tempos inválidos;
- conversão monotônica tick → tempo;
- notas com início e fim finitos, não negativos e dentro da extensão;
- acordes consolidados de forma determinística segundo a semântica RB adotada;
- nenhuma aproximação silenciosa de HOPO, forced strum ou tap desconhecido.

O snapshot de sessão deverá avançar de versão. O parser de snapshots antigos converte seu BPM fixo em um único evento de tempo sem reescrever o registro persistido. O snapshot novo registra `content.kind`, chart normalizada, identidade/revisão da música e referências exatas de parser e regra.

### 4.3 Pipeline de importação

Criar portas independentes de Vue:

```text
File/Blob
  -> PackageInspector
  -> StfsReader
  -> DtaParser
  -> StandardMidiReader
  -> RockBandFiveFretDecoder
  -> MoggInspector
  -> ImportedSongValidator
  -> LibraryImportCandidate
```

Responsabilidades sugeridas:

| Módulo | Responsabilidade |
| --- | --- |
| `src/importing/contracts` | envelopes, erros, limites e versões |
| `src/importing/stfs` | tabela de arquivos e leitura limitada de entradas |
| `src/importing/dta` | parser de dados e seleção do registro da música |
| `src/importing/midi` | SMF, metaeventos, SysEx e eventos por track |
| `src/importing/rock-band` | semântica de cinco frets por parte/dificuldade |
| `src/importing/mogg` | inspeção de variante, criptografia, canais e payload |
| `src/importing/worker` | coordenação fora da thread principal e progresso limitado |
| `src/platform/library` | IndexedDB, OPFS, quota e recuperação |

O Worker não grava diretamente registros finais. Ele devolve um candidato normalizado e um manifesto de assets; o coordenador da biblioteca aplica o protocolo de commit. Cancelar a tela de importação deve encerrar o Worker e limpar staging recuperável.

### 4.4 Transporte de áudio

Criar uma interface comum para o coordenador jogável:

```ts
interface SessionAudioTransport {
  prepare(): Promise<void>;
  start(countdownDeadlineMs: number): void;
  synchronize(): void;
  pause(): void;
  resume(countdownDeadlineMs: number, songOffsetMs: number): void;
  stop(): void;
  dispose(): Promise<void>;
}
```

Implementações:

- `MetronomeTransport`, adaptando o comportamento existente para drills;
- `SongAudioTransport`, reproduzindo o asset importado e usando a mesma âncora monotônica da sessão.

O áudio nunca deve avançar o julgamento. O transporte apenas converte entre `performance.now()`, `AudioContext.currentTime` e a posição musical congelada pela sessão. Pausar interrompe a fonte; retomar cria uma nova fonte agendada depois da contagem e inicia no offset musical preservado. Offsets de calibração continuam sendo aplicados uma única vez em suas fronteiras atuais, não embutidos no arquivo importado.

O spike inicial deve decidir entre:

- decodificação completa para `AudioBufferSourceNode`, mais simples e determinística, porém com custo alto de memória; ou
- decodificação/streaming incremental, mais complexo e apropriado a arquivos ou quantidades de canais maiores.

Até essa decisão, o MVP deve impor limites conservadores de duração, bytes e canais. O buffer PCM decodificado é transitório e não deve ser persistido; apenas o asset comprimido fica na biblioteca. Manter no máximo a música ativa em cache de memória.

### 4.5 Integração com sessão e julgamento

Mudanças necessárias:

1. substituir `SessionPreparation` único por união discriminada;
2. extrair validação canônica de chart da geração procedural;
3. fazer `InitialJudge` consumir notas já agendadas, sem chamar `generateDrill` indiretamente;
4. preservar o comportamento de charts procedurais por adaptação explícita para timeline de BPM único;
5. tornar `repeat` válido para música enquanto a mesma revisão existir;
6. ocultar ou recusar `vary` para músicas;
7. desabilitar adaptação procedural automática no modo de música;
8. registrar no resultado instrumento, dificuldade, música e revisão;
9. impedir comparação direta entre drill e música ou entre revisões/condições diferentes.

Se uma música for removida durante uma tentativa, os assets já abertos continuam pertencendo à tentativa; a exclusão física aguarda o encerramento ou marca o item para limpeza posterior. Trocar ou reimportar uma revisão nunca altera o snapshot ativo.

### 4.6 Interface

Rotas e telas sugeridas:

- `/library`: busca, ordenação, uso de espaço, importar e estados vazios/de erro;
- `/library/:id`: metadados, partes disponíveis, compatibilidade e exclusão;
- `/play`: reutilizada com uma preparação discriminada por conteúdo;
- resultado/histórico: exibe música, artista, instrumento, dificuldade e revisão.

O fluxo de importação deve apresentar etapas observáveis: lendo pacote, validando metadados, lendo MIDI, verificando áudio, conferindo espaço e salvando. Mensagens de erro precisam indicar se o problema está no pacote, chart, áudio, limite ou armazenamento, sem expor stack traces na interface.

## 5. Estratégia de armazenamento local

### 5.1 Decisão recomendada

Criar um banco `fretsense-library` separado de `fretsense-sessions`:

- **IndexedDB:** metadados estruturados, charts normalizadas, manifestos, estado de importação e índices de consulta;
- **OPFS (Origin Private File System):** MOGG e demais blobs grandes necessários à execução;
- **memória:** somente candidato em processamento, índices quentes e áudio decodificado da música ativa;
- **localStorage:** apenas preferências pequenas; nunca charts ou áudio.

A separação impede que migrações ou falhas da biblioteca alterem o histórico já existente. Também permite limpar assets grandes sem modificar stores de sessão.

### 5.2 Esquema IndexedDB inicial

**Banco:** `fretsense-library`
**Versão física inicial:** `1`

| Object store | Chave | Conteúdo e índices |
| --- | --- | --- |
| `songs` | `id` | registro da música; índices por título normalizado, artista, data e `revisionHash` único |
| `charts` | `[songId, instrument, difficulty, revisionHash]` | chart normalizada; índice por `songId` |
| `imports` | `id` | estado `staging`, `committing`, `ready`, `failed` ou `cleaning`; índice por data/estado |
| `asset-manifests` | `songId` | caminhos OPFS, hashes, MIME lógico, tamanho e versão do decodificador |

Os índices de busca usam campos normalizados gravados, sem recalcular sobre todos os registros a cada abertura. Registros desconhecidos ou incompatíveis são preservados e omitidos das consultas tipadas; não deve haver limpeza automática de dados que possam pertencer a uma versão mais nova.

### 5.3 Layout OPFS inicial

```text
/fretsense-library-v1/
  staging/<import-id>/
  songs/<song-id>/<revision-hash>/
    audio.mogg
    cover.bin          # opcional
    source.dta         # pequeno, útil para diagnóstico/reprocessamento
    source.mid         # preserva a fonte musical exata
```

Por padrão, não guardar uma segunda cópia integral do RB3CON depois de extrair os recursos exigidos. A interface pode oferecer futuramente “preservar pacote original”, com custo de espaço claramente mostrado. Os nomes internos do pacote nunca são usados diretamente como segmentos OPFS.

### 5.4 Commit e recuperação

IndexedDB e OPFS não compartilham uma transação. Portanto, a importação precisa de protocolo em duas fases:

1. consultar `navigator.storage.estimate()` e calcular bytes de entrada, staging e margem operacional;
2. solicitar armazenamento persistente por gesto do usuário quando aplicável, sem prometer que o navegador aceitará;
3. criar registro `imports: staging`;
4. gravar assets em `/staging/<import-id>` e calcular/verificar hashes durante a cópia;
5. analisar e validar todo o candidato antes de torná-lo visível;
6. gravar em uma transação IndexedDB os registros normalizados e mudar o import para `committing`;
7. materializar os assets no caminho final endereçado por conteúdo;
8. em outra transação curta, marcar música e import como `ready`;
9. remover staging somente depois da confirmação final.

Na inicialização, um recuperador limitado trata:

- `staging` antigo sem registro correspondente: remove somente a pasta exata do import órfão;
- `committing` com todos os hashes presentes: conclui o commit idempotentemente;
- `committing` incompleto: marca falha e limpa apenas os assets daquele import;
- asset final sem manifesto pronto: marca como órfão e remove após período de segurança;
- registro pronto com asset ausente/corrompido: preserva metadados, marca `broken` e oferece reimportação.

Nenhuma recuperação deve apagar o banco, a raiz OPFS ou registros incompatíveis em massa. Toda remoção é limitada por IDs e caminhos já validados.

### 5.5 Deduplicação e revisões

- calcular SHA-256 por streaming sempre que a API usada permitir;
- importação do mesmo `revisionHash` é idempotente e não duplica assets;
- mesmo `song_id` com hash diferente cria revisão distinta ou exige escolha explícita;
- charts compartilham os assets da revisão, sem copiar áudio por dificuldade;
- sessões nunca contêm MOGG, capa ou RB3CON;
- o snapshot da sessão congela a chart selecionada e metadados essenciais, mas referencia o áudio por `songId + revisionHash`.

Essa divisão preserva relatórios após a exclusão da música. Uma tentativa antiga continua legível, mas “tocar novamente” fica indisponível até que a mesma revisão seja reimportada. Reimportar bytes com o mesmo hash restaura a associação sem alterar o histórico.

### 5.6 Quota, persistência e comunicação ao usuário

Antes do commit, mostrar:

- tamanho do arquivo selecionado;
- estimativa do espaço adicional;
- uso e quota informados pelo navegador, quando disponíveis;
- se armazenamento persistente foi concedido;
- quais recursos serão retidos.

Se a quota for insuficiente, não iniciar um commit parcial. Oferecer exclusão de músicas escolhidas, sem excluir automaticamente sessões. OPFS e IndexedDB pertencem à origem: trocar domínio, porta, protocolo, perfil ou navegador produz outra biblioteca. Limpeza de dados do site pode remover tudo. A interface deve comunicar essas limitações e manter o RB3CON original como responsabilidade do usuário.

O fallback em memória usado para resultados de sessão não é apropriado para uma biblioteca musical: se OPFS/IndexedDB estiver indisponível, o candidato pode ser inspecionado, mas não deve aparecer como “salvo”. Uma execução transitória sem salvar pode ser avaliada depois, como recurso separado.

### 5.7 Exclusão e ciclo de vida

Exclusão de uma música:

1. exige confirmação com quantidade de charts e bytes;
2. marca o registro como `cleaning`;
3. impede novas tentativas, sem interromper uma tentativa ativa;
4. remove somente os assets da revisão sem referências ativas;
5. remove charts e registros da biblioteca em operação idempotente;
6. preserva sessões, resultados e relatórios;
7. informa falha parcial e permite repetir a limpeza.

Uma revisão não pode ser fisicamente removida enquanto houver um transporte de áudio ativo. O coordenador mantém uma referência em memória e libera o bloqueio em `dispose`.

## 6. Limites e segurança

Criar `IMPORT_LIMITS` separado de `ENGINE_LIMITS`. Os valores definitivos dependem das amostras controladas e da confirmação do desenvolvedor, mas devem cobrir explicitamente:

- bytes máximos do RB3CON e de cada entrada interna;
- quantidade máxima de entradas STFS e profundidade lógica;
- quantidade de músicas no pacote aceita pelo MVP: exatamente uma;
- tamanho e profundidade máximos da árvore DTA;
- tracks, eventos, notas, tempos, compassos e SysEx máximos no MIDI;
- TPQ, duração musical, canais MOGG e bytes de áudio máximos;
- tamanho máximo de strings e arte;
- tempo máximo de trabalho por lote do Worker e cancelamento cooperativo.

Outras garantias:

- nenhuma requisição de rede durante importação ou gameplay;
- nenhum upload automático de diagnóstico ou metadados;
- URLs de objeto revogadas ao trocar/excluir conteúdo;
- buffers e fontes de áudio descartados em saída, falha ou interrupção;
- erros técnicos normalizados, sem incluir bytes, caminhos privados ou dados completos no log copiável;
- CSP e renderização de texto continuam tratando metadados como texto não confiável;
- versões, hashes e decisões de compatibilidade entram no diagnóstico local.

## 7. Etapas de implementação

### Etapa A — Dossiê de formato e amostras controladas

**Objetivo:** remover as maiores incertezas antes de alterar o domínio.

- reunir apenas amostras próprias ou autorizadas: pacote simples, tempos variáveis, acordes/sustains, marcações HOPO/tap, áudio multicanal e casos deliberadamente inválidos;
- registrar estrutura STFS observada, encoding DTA, divisão MIDI, nomes de tracks e variantes MOGG;
- provar por inspeção qual subconjunto de MOGG pode ser aceito sem criptografia;
- definir a matriz inicial de compatibilidade e os limites provisórios;
- decidir parser TypeScript, biblioteca licenciada compatível ou módulo Wasm para cada camada;
- registrar o consumo de memória esperado das opções de áudio, sem declarar desempenho medido pelo agente.

**Saída:** dossiê versionado, amostras sob licença conhecida e decisão de áudio. Nenhuma compatibilidade é anunciada antes da confirmação do desenvolvedor.

### Etapa B — Conteúdo discriminado e timeline variável

**Dependência:** etapa A.

- criar `SessionContent`, `SongPlayConfig`, `ChartTimeline` e origem discriminada de nota;
- implementar índice de segmentos e conversão tick/tempo;
- adaptar charts procedurais para um único evento de tempo;
- criar nova versão de snapshot e manter leitura dos schemas anteriores;
- desacoplar validação da chart de `generateDrill`;
- adaptar renderer, julgador, relatórios e comparação para notas agendadas;
- manter o fluxo procedural sem alterações semânticas.

**Critério de conclusão:** revisão estática não identifica conversão direta pelo BPM único fora do adaptador procedural; snapshots antigos continuam com caminho de leitura explícito.

### Etapa C — Parsers dos arquivos internos

**Dependências:** etapas A e B.

- implementar DTA seguro e limitado;
- implementar/levar SMF para um modelo intermediário que preserve metaeventos e SysEx necessários;
- decodificar `PART GUITAR` Expert, acordes, sustains e articulações;
- compilar tempos, compassos, seções e extensão;
- inspecionar MOGG sem iniciar áudio;
- produzir `LibraryImportCandidate` e relatório de compatibilidade;
- executar parsing pesado em Worker cancelável.

**Critério de conclusão:** as amostras internas controladas produzem dados canônicos inspecionáveis, sem gravação persistente ou execução implícita.

### Etapa D — Leitura direta de RB3CON

**Dependência:** etapa C.

- validar assinatura e estrutura STFS;
- ler tabela de arquivos e blocos sob limites;
- localizar `songs.dta` e recursos referenciados;
- recusar packs no MVP com mensagem específica;
- impedir caminhos inválidos, sobreposição, ciclos e leituras além do arquivo;
- integrar progresso e cancelamento ao pipeline.

**Critério de conclusão:** o mesmo candidato da etapa C pode ser produzido a partir de um RB3CON simples aceito, sem expor detalhes STFS ao domínio ou à UI.

### Etapa E — Repositório da biblioteca

**Dependências:** etapas C e D.

- implementar contratos e parsers dos registros persistidos;
- criar IndexedDB separado e layout OPFS;
- implementar quota, staging, commit, idempotência e recuperação;
- implementar listagem, detalhe, deduplicação, revisão e exclusão;
- solicitar persistência somente por ação do usuário;
- expor estado persistente, indisponível, sem quota, incompatível e corrompido;
- nunca apresentar fallback em memória como música salva.

**Critério de conclusão:** todos os caminhos de escrita têm estado recuperável e alvo exato; excluir biblioteca não é necessário para resolver um import incompleto.

### Etapa F — Transporte de áudio musical

**Dependências:** decisões da etapa A e assets da etapa E.

- implementar decoder apenas para a variante de MOGG aceita;
- usar a disposição de canais conhecida para produzir a mixagem inicial;
- implementar preparação, início agendado, pausa, retomada, seek e descarte;
- vincular posição musical, `AudioContext` e relógio da sessão por uma única âncora;
- tratar suspensão, troca de contexto, arquivo ausente e falha de decode;
- aplicar limite de memória e manter somente o áudio ativo decodificado.

**Critério de conclusão:** a revisão estática encontra um único proprietário da posição ativa; áudio não fecha janelas de julgamento nem reaplica calibração.

### Etapa G — Biblioteca e gameplay integradas

**Dependências:** etapas B, E e F.

- criar rota, store e páginas da biblioteca;
- implementar seleção/importação com progresso e relatório de compatibilidade;
- selecionar parte/dificuldade suportada e preparar sessão `song`;
- adaptar HUD, contagem, pausa, finalização e ação de repetir;
- salvar resultados com identidade da música/revisão;
- desabilitar variação e adaptação procedural no contexto de música;
- preservar foco, mensagens acessíveis e captura somente na área jogável;
- atualizar pt-BR/en-US, README, guia da versão e diagnóstico.

**Critério de conclusão:** todo caminho da interface distingue claramente importado, salvo, executável, incompatível e removido; nenhuma chart externa é tratada como conteúdo procedural.

### Etapa H — Ampliações posteriores

Após confirmação do MVP pelo desenvolvedor, avaliar separadamente:

1. todas as dificuldades e bass;
2. packs com seleção de músicas e commit independente por item;
3. seções e prática por trecho;
4. score, multiplicador, estrelas, overdrive e regras versionadas de edição;
5. stems e comportamento de áudio por instrumento;
6. decoder adicional para variantes MOGG legalmente suportáveis;
7. importadores de pasta, `.mid` + áudio, Clone Hero e YARG usando o mesmo modelo normalizado;
8. exportação de índice/backup sem duplicação acidental de conteúdo protegido.

Cada formato novo implementa somente um adaptador de ingestão; biblioteca, timeline, sessão, renderer e julgamento permanecem independentes da origem.

## 8. Ordem de entrega sugerida

| Incremento | Etapas | Resultado demonstrável pelo desenvolvedor |
| --- | --- | --- |
| I1 — Redução de risco | A | subconjunto RB3CON/MOGG documentado e decisão técnica |
| I2 — Motor preparado | B | charts com tempos variáveis sem regressão intencional nos drills |
| I3 — Importação canônica | C e D | arquivo RB3CON produz metadados e chart inspecionável |
| I4 — Biblioteca local | E | importar, recarregar, listar e excluir com recuperação de falhas |
| I5 — Música jogável | F e G | guitarra Expert sincronizada ao áudio e resultado persistido |
| I6 — Fidelidade/formatos | H | expansões independentes guiadas por prioridade e evidência |

A etapa de áudio é um portão: se nenhuma variante MOGG-alvo puder ser decodificada com consumo aceitável, o projeto não deve declarar suporte RB3CON jogável. Nesse caso, as alternativas explícitas são aceitar RB3CON apenas para chart acompanhado de áudio externo selecionado pelo usuário, ou priorizar outro formato de pacote com áudio web compatível.

## 9. Critérios globais de aceite

- conteúdo procedural existente continua identificado e versionado separadamente;
- tempo variável não causa conversões por BPM global em julgamento ou desenho;
- chart, áudio e metadados pertencem à mesma revisão validada;
- importação inválida não deixa música visível nem asset órfão permanente;
- reiniciar a aplicação recupera ou limpa commits interrompidos de forma limitada;
- importar a mesma revisão não duplica áudio;
- excluir música preserva resultados anteriores;
- ausência da música impede replay, mas não impede abrir seu relatório;
- pausa, retomada e calibração não alteram a posição relativa entre áudio e chart;
- fechar/trocar rota descarta Worker, URLs, decoder, buffers e fontes ativos;
- UI nunca promete persistência, compatibilidade ou fidelidade não confirmadas;
- arquivos permanecem locais e nenhuma operação de rede é requisito do fluxo;
- o desenvolvedor confirma funcionamento, sincronização, memória, quota e compatibilidade nos ambientes-alvo antes de publicação.

## 10. Riscos e respostas

| Risco | Resposta planejada |
| --- | --- |
| variantes STFS/RB3CON | matriz explícita, parser limitado e erros por variante |
| MOGG criptografado ou não decodificável | fora do MVP; inspeção antes do commit e nenhuma promessa genérica |
| áudio multicanal consumir muita memória | limites, spike obrigatório, apenas uma música decodificada e opção futura de streaming |
| MIDI válido mas semanticamente incompatível | modelo intermediário, validação RB específica e diagnóstico por track/evento |
| perda ou limpeza de storage pelo navegador | persistência solicitada, aviso claro e RB3CON original como recuperação |
| falta de atomicidade IDB/OPFS | staging, estados de commit, hashes, operações idempotentes e coletor de órfãos limitado |
| duplicação entre biblioteca e sessões | binários só na biblioteca; snapshot conserva chart/metadados, nunca áudio |
| remoção quebrar histórico | histórico referencia identidade/revisão, mas guarda dados suficientes para relatório |
| comparação enganosa com drills/RB3 | origem e perfil de regras visíveis; comparações incompatíveis são recusadas |
| parser travar a interface | Worker, limites, cancelamento e progresso agregado |
| conteúdo ou código sem licença compatível | arquivos fornecidos pelo usuário ficam locais; dependências e ports exigem revisão de licença |

## 11. Encaminhamento e validação

Este plano não autoriza download de charts, inclusão de arquivos comerciais no repositório, contorno de criptografia nem cópia de código de ferramentas externas. As amostras de desenvolvimento precisam ser próprias ou explicitamente autorizadas.

Conforme `AGENTS.md`, a implementação pelo agente deverá ser validada somente por análise estática manual de código, tipos, imports, contratos, estados, migrações, limites e descarte de recursos. O agente não executará lint, formatação automática, testes, build, typecheck, aplicação, servidor, preview ou navegador. Confirmações de importação real, sincronização audiovisual, consumo de memória, quota, persistência e compatibilidade ficam a cargo do desenvolvedor responsável e devem ser registradas sem serem inferidas.

## 12. Referências técnicas para a implementação

- [Onyx Music Game Toolkit](https://github.com/mtolly/onyx): implementação de referência para leitura, conversão e inspeção de formatos Rock Band/Guitar Hero; qualquer reaproveitamento de código depende de análise da licença GPL-3.0.
- [Formato MIDI de guitarra de cinco frets](https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Tracks/5-Fret-Guitar.md): referência comunitária técnica para tracks, dificuldades, lanes e marcadores relacionados.
- [Web Audio API](https://www.w3.org/TR/webaudio-1.0/): agendamento, `AudioContext`, buffers e fontes de áudio.
- [Indexed Database API 3.0](https://www.w3.org/TR/IndexedDB/): registros estruturados, índices, transações e versionamento do banco.
- [File System Standard](https://fs.spec.whatwg.org/): OPFS, handles, leitura e escrita de arquivos privados da origem.
- [Storage Standard](https://storage.spec.whatwg.org/): quota, estimativa, persistência e modelo de armazenamento por origem.
