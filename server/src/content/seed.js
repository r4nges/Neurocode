// Conteúdo estático da fatia vertical (Fase 3). Blocos de aula:
//   { type: 'heading', text }       — subtítulo
//   { type: 'paragraph', text }     — parágrafo de teoria
//   { type: 'code', lang, text }    — exemplo de código
//   { type: 'list', items: [...] }  — lista de itens
// Endereçamento: roadmap/course por `slug`; aula por `id` (sem slug).

export const CONTENT = [
  {
    slug: 'desenvolvedor-front-end',
    title: 'Desenvolvedor Front-end',
    description: 'Construa interfaces na web do zero: HTML, CSS e JavaScript.',
    icon: 'Code2',
    isLocked: false,
    order: 1,
    courses: [
      {
        slug: 'html',
        title: 'HTML',
        description: 'A estrutura das páginas: tags, texto, links e imagens.',
        order: 1,
        badgeName: 'Estruturador',
        badgeIcon: 'FileCode',
        pointsReward: 100,
        lessons: [
          {
            title: 'O que é HTML',
            order: 1,
            conceptTags: ['html-basico', 'tags'],
            content: [
              { type: 'paragraph', text: 'HTML (HyperText Markup Language) é a linguagem que descreve a estrutura de uma página web. Não é programação: é marcação. Você usa "tags" para dizer ao navegador o que cada pedaço de conteúdo é.' },
              { type: 'heading', text: 'Uma página mínima' },
              { type: 'code', lang: 'html', text: '<!DOCTYPE html>\n<html>\n  <head>\n    <title>Minha página</title>\n  </head>\n  <body>\n    <h1>Olá, mundo!</h1>\n  </body>\n</html>' },
              { type: 'paragraph', text: 'O <head> guarda metadados (título, idioma, links). O <body> guarda tudo o que aparece na tela.' },
            ],
          },
          {
            title: 'Tags e estrutura',
            order: 2,
            conceptTags: ['elementos', 'estrutura-documento'],
            content: [
              { type: 'paragraph', text: 'Um elemento HTML quase sempre tem uma tag de abertura e uma de fechamento, com conteúdo no meio.' },
              { type: 'code', lang: 'html', text: '<p>Isto é um parágrafo.</p>\n<h2>Isto é um subtítulo</h2>' },
              { type: 'heading', text: 'Tags comuns' },
              { type: 'list', items: ['<h1>…<h6> — títulos, do mais ao menos importante', '<p> — parágrafo de texto', '<ul>/<ol> + <li> — listas', '<div> — agrupador genérico'] },
            ],
          },
          {
            title: 'Links e imagens',
            order: 3,
            conceptTags: ['ancoras', 'imagens'],
            content: [
              { type: 'paragraph', text: 'Links conectam páginas; imagens trazem conteúdo visual. Ambos usam atributos para informar o destino/origem.' },
              { type: 'code', lang: 'html', text: '<a href="https://exemplo.com">Visite o exemplo</a>\n<img src="gato.png" alt="Um gato dormindo" />' },
              { type: 'paragraph', text: 'O atributo alt descreve a imagem para leitores de tela e quando ela não carrega — acessibilidade importa.' },
            ],
          },
        ],
      },
      {
        slug: 'css',
        title: 'CSS',
        description: 'A aparência das páginas: cores, espaçamento e layout.',
        order: 2,
        badgeName: 'Estilista',
        badgeIcon: 'Palette',
        pointsReward: 120,
        lessons: [
          {
            title: 'Seletores',
            order: 1,
            conceptTags: ['seletores', 'especificidade'],
            content: [
              { type: 'paragraph', text: 'CSS (Cascading Style Sheets) estiliza o HTML. Você seleciona elementos e aplica regras a eles.' },
              { type: 'code', lang: 'css', text: 'p { color: purple; }\n.destaque { font-weight: bold; }\n#topo { padding: 20px; }' },
              { type: 'list', items: ['tag — seleciona por elemento (p, h1)', '.classe — seleciona por atributo class', '#id — seleciona um elemento único por id'] },
            ],
          },
          {
            title: 'Box model',
            order: 2,
            conceptTags: ['box-model', 'espacamento'],
            content: [
              { type: 'paragraph', text: 'Todo elemento é uma caixa com quatro camadas: conteúdo, padding (interno), border e margin (externo).' },
              { type: 'code', lang: 'css', text: '.card {\n  padding: 16px;   /* espaço interno */\n  border: 1px solid #ccc;\n  margin: 24px;    /* espaço externo */\n}' },
              { type: 'paragraph', text: 'Entender o box model é o que separa um layout bagunçado de um alinhado.' },
            ],
          },
          {
            title: 'Flexbox',
            order: 3,
            conceptTags: ['flexbox', 'layout'],
            content: [
              { type: 'paragraph', text: 'Flexbox alinha e distribui elementos em uma linha ou coluna. É a ferramenta padrão para layouts de componentes.' },
              { type: 'code', lang: 'css', text: '.barra {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n}' },
              { type: 'list', items: ['justify-content — alinha no eixo principal', 'align-items — alinha no eixo cruzado', 'gap — espaço entre os itens'] },
            ],
          },
        ],
      },
      {
        slug: 'javascript',
        title: 'JavaScript',
        description: 'O comportamento das páginas: variáveis, funções e interação.',
        order: 3,
        badgeName: 'Programador',
        badgeIcon: 'Braces',
        pointsReward: 150,
        lessons: [
          {
            title: 'Variáveis e tipos',
            order: 1,
            conceptTags: ['variaveis', 'tipos'],
            content: [
              { type: 'paragraph', text: 'JavaScript dá comportamento à página. Variáveis guardam valores; use const para o que não muda e let para o que muda.' },
              { type: 'code', lang: 'js', text: "const nome = 'Rangel';\nlet pontos = 0;\npontos = pontos + 10;\nconsole.log(nome, pontos); // Rangel 10" },
              { type: 'list', items: ['string — texto', 'number — números', 'boolean — true/false', 'array/object — coleções'] },
            ],
          },
          {
            title: 'Funções',
            order: 2,
            conceptTags: ['funcoes', 'escopo'],
            content: [
              { type: 'paragraph', text: 'Funções empacotam um pedaço de lógica reutilizável que recebe entradas e devolve uma saída.' },
              { type: 'code', lang: 'js', text: 'function dobro(n) {\n  return n * 2;\n}\nconst soma = (a, b) => a + b;\ndobro(21); // 42' },
              { type: 'paragraph', text: 'Arrow functions (=>) são uma forma curta de escrever funções.' },
            ],
          },
          {
            title: 'Eventos no DOM',
            order: 3,
            conceptTags: ['dom', 'eventos'],
            content: [
              { type: 'paragraph', text: 'O DOM é a representação da página como objetos. Com JS você lê e muda elementos e reage a eventos do usuário.' },
              { type: 'code', lang: 'js', text: "const botao = document.querySelector('#salvar');\nbotao.addEventListener('click', () => {\n  alert('Salvo!');\n});" },
              { type: 'paragraph', text: 'addEventListener conecta uma ação (clique, tecla) a uma função que roda quando ela acontece.' },
            ],
          },
        ],
      },
    ],
  },
  { slug: 'devops', title: 'DevOps', description: 'CI/CD, containers e infraestrutura. Em breve.', icon: 'Server', isLocked: true, order: 2, courses: [] },
  { slug: 'back-end', title: 'Back-end', description: 'APIs, bancos de dados e autenticação. Em breve.', icon: 'Database', isLocked: true, order: 3, courses: [] },
  { slug: 'data', title: 'Data Science', description: 'Análise de dados, Python e visualização. Em breve.', icon: 'BarChart3', isLocked: true, order: 4, courses: [] },
];

export async function seedContent(prisma) {
  for (const rm of CONTENT) {
    const roadmap = await prisma.roadmap.upsert({
      where: { slug: rm.slug },
      update: { title: rm.title, description: rm.description, icon: rm.icon, isLocked: rm.isLocked, order: rm.order },
      create: { slug: rm.slug, title: rm.title, description: rm.description, icon: rm.icon, isLocked: rm.isLocked, order: rm.order },
    });
    for (const c of rm.courses ?? []) {
      const course = await prisma.course.upsert({
        where: { slug: c.slug },
        update: {
          roadmapId: roadmap.id, title: c.title, description: c.description, order: c.order,
          badgeName: c.badgeName, badgeIcon: c.badgeIcon, pointsReward: c.pointsReward,
        },
        create: {
          roadmapId: roadmap.id, slug: c.slug, title: c.title, description: c.description, order: c.order,
          badgeName: c.badgeName, badgeIcon: c.badgeIcon, pointsReward: c.pointsReward,
        },
      });
      // Atualiza aulas no lugar (IDs estáveis) para evitar corrida com testes paralelos.
      // Aulas cujo `order` não existe mais no seed são removidas ao final.
      for (const l of c.lessons ?? []) {
        const data = {
          title: l.title,
          content: JSON.stringify(l.content),
          conceptTags: JSON.stringify(l.conceptTags),
        };
        const existing = await prisma.lesson.findFirst({ where: { courseId: course.id, order: l.order } });
        if (existing) {
          await prisma.lesson.update({ where: { id: existing.id }, data });
        } else {
          await prisma.lesson.create({ data: { courseId: course.id, order: l.order, ...data } });
        }
      }
      const keptOrders = (c.lessons ?? []).map((l) => l.order);
      await prisma.lesson.deleteMany({
        where: { courseId: course.id, order: { notIn: keptOrders.length ? keptOrders : [-1] } },
      });
    }
  }
}
