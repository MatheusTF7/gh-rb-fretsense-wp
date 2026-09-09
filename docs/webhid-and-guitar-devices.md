# Guitarras, Gamepad e WebHID — etapa 17

**Estado:** implementação revisada somente por análise estática manual. Não houve execução da aplicação, testes, lint, build, typecheck, navegador ou confirmação com hardware real.

## Escopo entregue

O Fretsense aceita perfis de teclado, Gamepad e WebHID pelo mesmo contrato de entrada normalizada, mapeamento, calibração e snapshot de sessão. Uma guitarra de Guitar Hero ou Rock Band que apareça na Gamepad API continua usando esse caminho, que é o preferido. WebHID é o fallback para um dispositivo autorizado que entregue controles discretos em input reports.

Cada conexão recebe uma identidade observável com transporte, nome reportado e, quando WebHID, `vendorId` e `productId`. O aplicativo classifica como família `guitar-hero` ou `rock-band` somente quando o nome contém um termo reconhecível, como “Guitar Hero”, “RedOctane”, “Xplorer”, “Rock Band”, “Harmonix” ou “Stratocaster”. Essa classificação `reported-name` ajuda a identificar a guitarra na interface, mas não confirma modelo, revisão, layout de relatório nem compatibilidade. IDs USB são informativos e não há uma tabela presumida de VID/PID; número de série não é lido nem persistido.

## Autorização e seleção

WebHID só é apresentado como disponível em contexto seguro e quando `navigator.hid` existe. **Autorizar dispositivo WebHID** abre o seletor nativo por uma ação explícita. Cancelamento, recusa ou bloqueio são recuperáveis e não removem teclado/Gamepad. `getDevices()` recupera apenas dispositivos anteriormente autorizados; uma conexão precisa corresponder à identidade de hardware congelada no perfil antes de capturar, calibrar ou treinar.

A abertura da conexão é assíncrona e acontece antes da captura. Desconexão durante captura usa a mesma interrupção `device-disconnected` dos Gamepads: o adaptador para, limpa o baseline e o fluxo jogável pausa. Reconectar exige selecionar uma conexão compatível e retomar explicitamente.

## Formato WebHID atendido

O adaptador `discrete-bit-v1` observa transições inativas→ativas de bits nos bytes de cada input report. O mapeamento guarda `reportId`, índice do byte, índice do bit e o valor ativo observado. Assim, nenhum bit recebe silenciosamente o significado de fret, strum, pausa, botão solo, mão ou dedo: a pessoa precisa acioná-lo no assistente para atribuir uma ação. Se o primeiro acionamento apenas estabelecer o baseline de um dispositivo que não emite relatórios em repouso, solte e acione o controle novamente.

Esse formato atende controles digitais ativos em nível alto e expostos como bits estáveis. Campos empacotados, bits ativos em nível baixo, hats que compartilham vários bits, valores analógicos, inicialização por feature/output report e protocolos proprietários não são interpretados por suposição. Se um strum ou fret não produzir um bit discreto distinguível, o modelo não está explicitamente atendido por este adaptador e deve usar Gamepad ou receber um adaptador de relatório próprio em uma revisão futura.

Botões solo podem aparecer entre os controles extras distinguíveis, mas continuam sem semântica automática. Whammy e tilt não fazem parte das ações normalizadas atuais.

## Referências e limites de confirmação

- [WebHID no Chrome for Developers](https://developer.chrome.com/docs/capabilities/hid): permissão, `getDevices`, abertura assíncrona, input reports, identificação por VID/PID e eventos de conexão.
- [Especificação WebHID](https://wicg.github.io/webhid/): contrato da API, modelo de permissão e considerações de segurança.
- [Gamepad do W3C](https://www.w3.org/TR/gamepad/): caminho preferencial quando o navegador já expõe a guitarra como Gamepad.

Compatibilidade permanece por modelo, adaptador, sistema operacional e navegador. A implementação não declara que toda guitarra GH/RB funciona e depende de confirmação do desenvolvedor com o hardware-alvo. Um relato útil inclui nome exibido, transporte, VID/PID quando visíveis, controles que mudaram, mapeamento tentado e resultado observado.
