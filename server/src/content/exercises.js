// Banco embutido de exercícios (Fase 4). Etiquetados por conceito + dificuldade (1-3).
// Codificação por tipo (ver docs/superpowers/plans .../Global Constraints):
//   multiple-choice → options: string[]; answer: índice correto (number)
//   fill-blank      → options: [];        answer: string esperada
//   predict-output  → options: [];        answer: saída esperada (string)
//   order-lines     → options: linhas na ordem apresentada; answer: índices na ordem correta
// conceptTag deve bater EXATO com os conceptTags das aulas (content/seed.js).
// explanation: uma frase curta dizendo POR QUE a resposta certa está certa (RF-17).

export const EXERCISES = [
  // ===== HTML / html-basico =====
  { conceptTag: 'html-basico', type: 'multiple-choice', difficulty: 1,
    prompt: 'O que significa a sigla HTML?',
    options: ['HyperText Markup Language', 'High Tech Modern Language', 'Hyperlink Text Mode'],
    answer: 0,
    explanation: 'HTML = HyperText Markup Language: a linguagem de marcação que estrutura o conteúdo de páginas web.' },
  { conceptTag: 'html-basico', type: 'fill-blank', difficulty: 2,
    prompt: 'Complete: a tag que envolve todo o conteúdo visível da página é <____>.',
    options: [], answer: 'body',
    explanation: 'O <body> envolve todo o conteúdo visível; o <head> guarda apenas metadados.' },
  { conceptTag: 'html-basico', type: 'multiple-choice', difficulty: 2,
    prompt: 'Onde ficam os metadados (título, idioma) de uma página?',
    options: ['<body>', '<head>', '<footer>'], answer: 1,
    explanation: 'Metadados como título e idioma ficam no <head>, não no <body>, que contém o conteúdo visível.' },
  // ===== HTML / tags =====
  { conceptTag: 'tags', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual tag define um título de nível 1?',
    options: ['<p>', '<h1>', '<span>'], answer: 1,
    explanation: '<h1> é o título de nível 1; <p> é parágrafo e <span> é um trecho genérico em linha.' },
  { conceptTag: 'tags', type: 'fill-blank', difficulty: 1,
    prompt: 'Complete a tag de parágrafo: <__>Texto</p>',
    options: [], answer: 'p',
    explanation: 'A tag de parágrafo é <p>…</p>.' },
  { conceptTag: 'tags', type: 'order-lines', difficulty: 3,
    prompt: 'Ordene para formar uma lista não-ordenada com um item.',
    options: ['</ul>', '<ul>', '<li>Item</li>'], answer: [1, 2, 0],
    explanation: 'Abre <ul>, coloca o <li> dentro e fecha </ul>: o item fica aninhado na lista.' },
  // ===== HTML / elementos =====
  { conceptTag: 'elementos', type: 'multiple-choice', difficulty: 1,
    prompt: 'Um elemento HTML normalmente tem:',
    options: ['só uma tag de abertura', 'abertura, conteúdo e fechamento', 'apenas texto'],
    answer: 1,
    explanation: 'Um elemento típico tem tag de abertura, conteúdo e tag de fechamento, ex.: <p>texto</p>.' },
  { conceptTag: 'elementos', type: 'fill-blank', difficulty: 2,
    prompt: 'Complete o subtítulo de nível 2: <h2>Título</__>',
    options: [], answer: 'h2',
    explanation: 'A tag de fechamento repete o nome da de abertura: <h2>…</h2>.' },
  // ===== HTML / estrutura-documento =====
  { conceptTag: 'estrutura-documento', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual declaração inicia um documento HTML5?',
    options: ['<html5>', '<!DOCTYPE html>', '<doctype>'], answer: 1,
    explanation: '<!DOCTYPE html> declara o documento como HTML5 e vem na primeira linha.' },
  { conceptTag: 'estrutura-documento', type: 'order-lines', difficulty: 2,
    prompt: 'Ordene a estrutura mínima de uma página.',
    options: ['<body></body>', '<!DOCTYPE html>', '<head></head>'], answer: [1, 2, 0],
    explanation: 'A ordem é <!DOCTYPE html>, depois <head> e por fim <body>.' },
  // ===== HTML / ancoras =====
  { conceptTag: 'ancoras', type: 'fill-blank', difficulty: 1,
    prompt: 'Qual atributo define o destino de um link <a>? (só o nome)',
    options: [], answer: 'href',
    explanation: 'O atributo href define o destino (URL) de um link <a>.' },
  { conceptTag: 'ancoras', type: 'multiple-choice', difficulty: 2,
    prompt: 'Como abrir um link em nova aba?',
    options: ['target="_blank"', 'newtab="true"', 'open="new"'], answer: 0,
    explanation: 'target="_blank" instrui o navegador a abrir o destino do link em uma nova aba.' },
  // ===== HTML / imagens =====
  { conceptTag: 'imagens', type: 'fill-blank', difficulty: 1,
    prompt: 'Qual atributo descreve a imagem para acessibilidade? (só o nome)',
    options: [], answer: 'alt',
    explanation: 'O atributo alt descreve a imagem para leitores de tela e quando ela não carrega.' },
  { conceptTag: 'imagens', type: 'multiple-choice', difficulty: 2,
    prompt: 'Qual atributo aponta o arquivo da imagem?',
    options: ['href', 'src', 'link'], answer: 1,
    explanation: 'O atributo src aponta o arquivo (origem) da imagem; alt é o texto alternativo.' },

  // ===== CSS / seletores =====
  { conceptTag: 'seletores', type: 'multiple-choice', difficulty: 1,
    prompt: 'Como se seleciona um elemento com class="destaque" em CSS?',
    options: ['#destaque', '.destaque', 'destaque'], answer: 1,
    explanation: 'Classes são selecionadas com ponto: .destaque; # seleciona id e sem símbolo seria uma tag.' },
  { conceptTag: 'seletores', type: 'fill-blank', difficulty: 1,
    prompt: 'Complete: para selecionar pelo id "topo" usa-se ____topo { }',
    options: [], answer: '#',
    explanation: 'Ids são selecionados com cerquilha: #topo { }.' },
  { conceptTag: 'seletores', type: 'multiple-choice', difficulty: 2,
    prompt: 'O seletor "p.aviso" seleciona:',
    options: ['todo <p> dentro de .aviso', 'todo <p> que também tem class aviso', 'todo elemento .aviso'], answer: 1,
    explanation: 'p.aviso casa todo <p> que também tem class="aviso" (elemento e classe no mesmo elemento).' },

  // ===== CSS / especificidade =====
  { conceptTag: 'especificidade', type: 'multiple-choice', difficulty: 2,
    prompt: 'Qual seletor tem MAIOR especificidade?',
    options: ['p', '.texto', '#titulo'], answer: 2,
    explanation: 'Id (#) tem especificidade maior que classe (.), que por sua vez supera o seletor de tag.' },
  { conceptTag: 'especificidade', type: 'fill-blank', difficulty: 3,
    prompt: 'Complete: !important _____ qualquer outra regra CSS (uma palavra em inglês).',
    options: [], answer: 'overrides',
    explanation: '!important overrides (sobrepõe) qualquer outra regra concorrente, independentemente da especificidade.' },
  { conceptTag: 'especificidade', type: 'multiple-choice', difficulty: 1,
    prompt: 'Se dois seletores conflitam, qual vence?',
    options: ['o que vem primeiro no arquivo', 'o de maior especificidade', 'sempre o seletor de tag'], answer: 1,
    explanation: 'No conflito, vence a regra de maior especificidade; a ordem no arquivo só decide em empate.' },

  // ===== CSS / box-model =====
  { conceptTag: 'box-model', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual propriedade define o espaço INTERNO entre o conteúdo e a borda?',
    options: ['margin', 'padding', 'border'], answer: 1,
    explanation: 'padding é o espaço interno entre o conteúdo e a borda; margin é o espaço externo.' },
  { conceptTag: 'box-model', type: 'order-lines', difficulty: 2,
    prompt: 'Ordene as camadas do box model, da mais interna para a mais externa.',
    options: ['border', 'conteúdo', 'margin', 'padding'], answer: [1, 3, 0, 2],
    explanation: 'Do interno ao externo: conteúdo, padding, border e margin.' },
  { conceptTag: 'box-model', type: 'fill-blank', difficulty: 2,
    prompt: 'A propriedade que define a espessura da borda é ______.',
    options: [], answer: 'border',
    explanation: 'A borda (e sua espessura) é definida por border, ex.: border: 1px solid #ccc.' },

  // ===== CSS / espacamento =====
  { conceptTag: 'espacamento', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual propriedade CSS define o espaço EXTERNO ao redor de um elemento?',
    options: ['padding', 'margin', 'gap'], answer: 1,
    explanation: 'margin é o espaço externo ao redor do elemento; padding é o espaço interno.' },
  { conceptTag: 'espacamento', type: 'fill-blank', difficulty: 2,
    prompt: 'Para centralizar um bloco horizontalmente com margin, use margin: 0 ____.',
    options: [], answer: 'auto',
    explanation: 'margin: 0 auto distribui igualmente o espaço lateral e centraliza o bloco.' },
  { conceptTag: 'espacamento', type: 'multiple-choice', difficulty: 3,
    prompt: 'O que acontece quando dois margens verticais se encontram?',
    options: ['somam', 'colapsam (o maior prevalece)', 'cancelam'], answer: 1,
    explanation: 'Margens verticais adjacentes colapsam: prevalece a maior, elas não se somam.' },

  // ===== CSS / flexbox =====
  { conceptTag: 'flexbox', type: 'multiple-choice', difficulty: 1,
    prompt: 'Para ativar o Flexbox em um contêiner, usa-se:',
    options: ['display: block', 'display: flex', 'flex: 1'], answer: 1,
    explanation: 'display: flex transforma o contêiner em flexível, habilitando o layout Flexbox.' },
  { conceptTag: 'flexbox', type: 'fill-blank', difficulty: 2,
    prompt: 'Para centralizar itens no eixo principal use justify-content: ______.',
    options: [], answer: 'center',
    explanation: 'justify-content: center centraliza os itens ao longo do eixo principal.' },
  { conceptTag: 'flexbox', type: 'multiple-choice', difficulty: 2,
    prompt: 'Qual propriedade alinha itens no eixo cruzado do Flexbox?',
    options: ['justify-content', 'align-items', 'flex-direction'], answer: 1,
    explanation: 'align-items alinha no eixo cruzado; justify-content cuida do eixo principal.' },

  // ===== CSS / layout =====
  { conceptTag: 'layout', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual valor de display faz um elemento ocupar toda a largura disponível?',
    options: ['inline', 'block', 'inline-block'], answer: 1,
    explanation: 'Elementos block ocupam toda a largura disponível e quebram linha; inline não.' },
  { conceptTag: 'layout', type: 'fill-blank', difficulty: 2,
    prompt: 'Para posicionar um elemento relativo ao viewport, use position: ______.',
    options: [], answer: 'fixed',
    explanation: 'position: fixed posiciona o elemento relativo ao viewport, mantendo-o fixo ao rolar.' },
  { conceptTag: 'layout', type: 'multiple-choice', difficulty: 3,
    prompt: 'Qual propriedade CSS cria um layout de grade bidimensional?',
    options: ['display: flex', 'display: grid', 'display: table'], answer: 1,
    explanation: 'display: grid cria um layout de grade bidimensional, com linhas e colunas.' },

  // ===== JS / variaveis =====
  { conceptTag: 'variaveis', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual palavra-chave declara uma variável que NÃO pode ser reatribuída?',
    options: ['let', 'var', 'const'], answer: 2,
    explanation: 'const declara uma constante: seu vínculo não pode ser reatribuído depois.' },
  { conceptTag: 'variaveis', type: 'predict-output', difficulty: 2,
    prompt: 'Qual é a saída?\nlet x = 5;\nx = x + 3;\nconsole.log(x);',
    options: [], answer: '8',
    explanation: 'x começa em 5 e é reatribuído para 5 + 3 = 8, valor impresso.' },
  { conceptTag: 'variaveis', type: 'fill-blank', difficulty: 1,
    prompt: 'Complete: para declarar uma variável que pode mudar, use ____.',
    options: [], answer: 'let',
    explanation: 'let declara uma variável reatribuível; const é para valores que não mudam.' },

  // ===== JS / tipos =====
  { conceptTag: 'tipos', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual é o tipo de "true" em JavaScript?',
    options: ['string', 'number', 'boolean'], answer: 2,
    explanation: 'true e false são valores do tipo boolean.' },
  { conceptTag: 'tipos', type: 'predict-output', difficulty: 2,
    prompt: 'Qual é a saída?\nconsole.log(typeof "olá");',
    options: [], answer: 'string',
    explanation: 'typeof de um texto retorna a string "string".' },
  { conceptTag: 'tipos', type: 'multiple-choice', difficulty: 2,
    prompt: 'Qual é o resultado de typeof null em JS?',
    options: ['null', 'object', 'undefined'], answer: 1,
    explanation: 'typeof null retorna "object" — uma peculiaridade histórica do JavaScript.' },

  // ===== JS / funcoes =====
  { conceptTag: 'funcoes', type: 'multiple-choice', difficulty: 1,
    prompt: 'O que uma função sem "return" retorna por padrão?',
    options: ['0', 'null', 'undefined'], answer: 2,
    explanation: 'Sem um return explícito, a função retorna undefined.' },
  { conceptTag: 'funcoes', type: 'predict-output', difficulty: 2,
    prompt: 'Qual é a saída?\nfunction dobro(n) { return n * 2; }\nconsole.log(dobro(7));',
    options: [], answer: '14',
    explanation: 'dobro(7) retorna 7 * 2 = 14.' },
  { conceptTag: 'funcoes', type: 'fill-blank', difficulty: 2,
    prompt: 'Complete a arrow function: const soma = (a, b) => ____.',
    options: [], answer: 'a + b',
    explanation: 'Uma arrow sem chaves retorna a expressão diretamente: (a, b) => a + b.' },

  // ===== JS / escopo =====
  { conceptTag: 'escopo', type: 'multiple-choice', difficulty: 2,
    prompt: 'Uma variável declarada com "let" dentro de uma função está disponível:',
    options: ['em todo o arquivo', 'apenas dentro da função', 'em qualquer bloco global'], answer: 1,
    explanation: 'let tem escopo de bloco: só existe dentro da função (ou bloco) onde foi declarada.' },
  { conceptTag: 'escopo', type: 'predict-output', difficulty: 3,
    prompt: 'Qual é a saída?\nlet x = 1;\nfunction teste() { let x = 2; console.log(x); }\nteste();',
    options: [], answer: '2',
    explanation: 'O x interno (2) sombreia o externo dentro da função, então imprime 2.' },
  { conceptTag: 'escopo', type: 'fill-blank', difficulty: 2,
    prompt: 'Variáveis declaradas com "var" têm escopo de ______ (uma palavra).',
    options: [], answer: 'função',
    explanation: 'var tem escopo de função (não de bloco como let e const).' },

  // ===== JS / dom =====
  { conceptTag: 'dom', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual método JS seleciona o primeiro elemento que corresponde ao seletor CSS?',
    options: ['getElementById', 'querySelector', 'getElement'], answer: 1,
    explanation: 'querySelector retorna o primeiro elemento que casa com o seletor CSS informado.' },
  { conceptTag: 'dom', type: 'fill-blank', difficulty: 2,
    prompt: 'Para ler ou mudar apenas o texto de um elemento, acessa-se a propriedade ______Content (uma palavra).',
    options: [], answer: 'text',
    explanation: 'textContent lê ou altera apenas o texto de um elemento.' },
  { conceptTag: 'dom', type: 'multiple-choice', difficulty: 2,
    prompt: 'O que é o DOM?',
    options: [
      'Um banco de dados da página',
      'A representação da página como árvore de objetos',
      'O arquivo HTML no servidor',
    ], answer: 1,
    explanation: 'O DOM é a representação da página como uma árvore de objetos, manipulável por JavaScript.' },

  // ===== JS / eventos =====
  { conceptTag: 'eventos', type: 'multiple-choice', difficulty: 1,
    prompt: 'Qual método conecta uma função a um evento em um elemento?',
    options: ['on', 'addEventListener', 'bindEvent'], answer: 1,
    explanation: 'addEventListener conecta uma função (handler) a um evento do elemento.' },
  { conceptTag: 'eventos', type: 'fill-blank', difficulty: 2,
    prompt: 'Complete: botao.addEventListener("______", handler) para reagir a cliques.',
    options: [], answer: 'click',
    explanation: 'O evento de clique se chama "click".' },
  { conceptTag: 'eventos', type: 'multiple-choice', difficulty: 2,
    prompt: 'O objeto "event" passado ao handler contém:',
    options: [
      'informações sobre o evento ocorrido',
      'a lista de todos os elementos da página',
      'o código-fonte do arquivo JS',
    ], answer: 0,
    explanation: 'O objeto event carrega informações sobre o evento ocorrido (alvo, tipo, posição…).' },
];

export async function seedExercises(prisma) {
  // Mapa conceito -> aula dona (a 1ª aula cujo conceptTags contém o conceito).
  const lessons = await prisma.lesson.findMany({ select: { id: true, conceptTags: true } });
  const ownerByConcept = new Map();
  for (const l of lessons) {
    for (const c of JSON.parse(l.conceptTags)) {
      if (!ownerByConcept.has(c)) ownerByConcept.set(c, l.id);
    }
  }
  // Agrupa o banco por conceito.
  const byConcept = new Map();
  for (const e of EXERCISES) {
    const list = byConcept.get(e.conceptTag) ?? [];
    list.push(e);
    byConcept.set(e.conceptTag, list);
  }
  for (const [concept, list] of byConcept) {
    const lessonId = ownerByConcept.get(concept);
    if (!lessonId) continue; // conceito sem aula dona: ignora (não deve acontecer)
    // Substitui apenas os exercícios do BANCO desse conceito (preserva os gerados por IA e os Attempt).
    await prisma.exercise.deleteMany({ where: { lessonId, conceptTag: concept, source: 'bank' } });
    for (const e of list) {
      await prisma.exercise.create({
        data: {
          lessonId,
          type: e.type,
          prompt: e.prompt,
          options: JSON.stringify(e.options),
          answer: JSON.stringify(e.answer),
          difficulty: e.difficulty,
          conceptTag: e.conceptTag,
          explanation: e.explanation ?? null,
          source: 'bank',
        },
      });
    }
  }
}
