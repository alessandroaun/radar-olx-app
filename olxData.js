// =====================================================================
// DADOS OFICIAIS DE ESTADOS E REGIÕES DA OLX BRASIL (27 UFs)
// =====================================================================

export const OLX_ESTADOS = {
  BR: {
    nome: "Brasil Inteiro (Todas as Regiões)",
    slug: "brasil",
    regioes: [
      { nome: "Todas as Regiões", slug: "" }
    ]
  },
  AC: {
    nome: "Acre",
    slug: "estado-ac",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Rio Branco", slug: "rio-branco" }
    ]
  },
  AL: {
    nome: "Alagoas",
    slug: "estado-al",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Maceió e região", slug: "maceio" },
      { nome: "Agreste de Alagoas", slug: "agreste-de-alagoas" },
      { nome: "Sertão de Alagoas", slug: "sertao-de-alagoas" }
    ]
  },
  AP: {
    nome: "Amapá",
    slug: "estado-ap",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Macapá", slug: "macapa" }
    ]
  },
  AM: {
    nome: "Amazonas",
    slug: "estado-am",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Manaus e região", slug: "regiao-de-manaus" }
    ]
  },
  BA: {
    nome: "Bahia",
    slug: "estado-ba",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Salvador e região", slug: "salvador" },
      { nome: "Feira de Santana e região", slug: "feira-de-santana-e-regiao" },
      { nome: "Vitória da Conquista e região", slug: "vitoria-da-conquista-e-regiao" },
      { nome: "Sul da Bahia (Ilhéus, Itabuna)", slug: "sul-da-bahia" },
      { nome: "Oeste da Bahia (Barreiras)", slug: "oeste-da-bahia" },
      { nome: "Norte da Bahia (Juazeiro)", slug: "juazeiro-e-regiao" }
    ]
  },
  CE: {
    nome: "Ceará",
    slug: "estado-ce",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Fortaleza e região", slug: "fortaleza-e-regiao" },
      { nome: "Juazeiro do Norte, Sobral e região", slug: "regiao-de-juazeiro-do-norte-e-sobral" }
    ]
  },
  DF: {
    nome: "Distrito Federal",
    slug: "distrito-federal-e-regiao",
    regioes: [
      { nome: "Brasília e região", slug: "" }
    ]
  },
  ES: {
    nome: "Espírito Santo",
    slug: "estado-es",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Grande Vitória", slug: "norte-do-espirito-santo" },
      { nome: "Sul do Espírito Santo", slug: "sul-do-espirito-santo" }
    ]
  },
  GO: {
    nome: "Goiás",
    slug: "estado-go",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Goiânia e região", slug: "grande-goiania-e-anapolis" },
      { nome: "Rio Verde, Caldas Novas e região", slug: "regiao-de-rio-verde-e-caldas-novas" }
    ]
  },
  MA: {
    nome: "Maranhão",
    slug: "estado-ma",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "São Luís e região", slug: "regiao-de-sao-luis" },
      { nome: "Imperatriz e região", slug: "regiao-de-imperatriz" }
    ]
  },
  MT: {
    nome: "Mato Grosso",
    slug: "estado-mt",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Cuiabá e região", slug: "cuiaba-e-regiao" },
      { nome: "Rondonópolis, Sinop e região", slug: "regiao-de-rondonopolis-e-sinop" }
    ]
  },
  MS: {
    nome: "Mato Grosso do Sul",
    slug: "estado-ms",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Campo Grande e região", slug: "campo-grande-e-regiao" },
      { nome: "Dourados e região", slug: "dourados-e-regiao" }
    ]
  },
  MG: {
    nome: "Minas Gerais",
    slug: "estado-mg",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Belo Horizonte e região", slug: "belo-horizonte-e-regiao" },
      { nome: "Triângulo Mineiro e Alto Paranaíba", slug: "triangulo-mineiro" },
      { nome: "Zona da Mata", slug: "zona-da-mata" },
      { nome: "Sul de Minas", slug: "sul-de-minas" },
      { nome: "Centro de Minas", slug: "centro-de-minas" },
      { nome: "Norte de Minas", slug: "norte-de-minas" },
      { nome: "Vales do Rio Doce e Mucuri", slug: "vales-do-rio-doce-e-mucuri" }
    ]
  },
  PA: {
    nome: "Pará",
    slug: "estado-pa",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Belém e região", slug: "regiao-de-belem" },
      { nome: "Santarém e região", slug: "regiao-de-santarem" },
      { nome: "Marabá e região", slug: "regiao-de-maraba" }
    ]
  },
  PB: {
    nome: "Paraíba",
    slug: "estado-pb",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "João Pessoa e região", slug: "joao-pessoa-e-regiao" },
      { nome: "Campina Grande e região", slug: "campina-grande-e-regiao" }
    ]
  },
  PR: {
    nome: "Paraná",
    slug: "estado-pr",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Curitiba e região", slug: "curitiba-e-regiao" },
      { nome: "Londrina e região", slug: "regiao-de-londrina" },
      { nome: "Maringá e região", slug: "regiao-de-maringa" },
      { nome: "Foz do Iguaçu, Cascavel e região", slug: "regiao-de-foz-do-iguacu-e-cascavel" },
      { nome: "Ponta Grossa e região", slug: "regiao-de-ponta-grossa-e-guarapuava" }
    ]
  },
  PE: {
    nome: "Pernambuco",
    slug: "estado-pe",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Recife e região", slug: "grande-recife" },
      { nome: "Caruaru, Petrolina e região", slug: "regiao-de-petrolina-e-garanhuns" }
    ]
  },
  PI: {
    nome: "Piauí",
    slug: "estado-pi",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Teresina e Parnaíba", slug: "regiao-de-teresina-e-parnaiba" }
    ]
  },
  RJ: {
    nome: "Rio de Janeiro",
    slug: "estado-rj",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Rio de Janeiro e região", slug: "rio-de-janeiro-e-regiao" },
      { nome: "Niterói e região", slug: "serra-angra-dos-reis-e-regiao" },
      { nome: "Norte do Estado (Campos, Macaé)", slug: "norte-do-estado-do-rio" },
      { nome: "Região dos Lagos", slug: "regiao-dos-lagos" }
    ]
  },
  RN: {
    nome: "Rio Grande do Norte",
    slug: "estado-rn",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Natal e região", slug: "regiao-de-natal" },
      { nome: "Mossoró e região", slug: "regiao-de-mossoro" }
    ]
  },
  RS: {
    nome: "Rio Grande do Sul",
    slug: "estado-rs",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Porto Alegre e região", slug: "porto-alegre-e-regiao" },
      { nome: "Caxias do Sul e Serra", slug: "serra-gaucha" },
      { nome: "Pelotas, Rio Grande e região", slug: "regioes-de-pelotas-rio-grande-e-bage" },
      { nome: "Santa Maria e região", slug: "regioes-de-santa-maria-uruguaiana-e-cruz-alta" },
      { nome: "Passo Fundo e região", slug: "passo-fundo-e-regiao" }
    ]
  },
  RO: {
    nome: "Rondônia",
    slug: "estado-ro",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Porto Velho e região", slug: "porto-velho-e-regiao" }
    ]
  },
  RR: {
    nome: "Roraima",
    slug: "estado-rr",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Boa Vista", slug: "boa-vista" }
    ]
  },
  SC: {
    nome: "Santa Catarina",
    slug: "estado-sc",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Florianópolis e região", slug: "florianopolis-e-regiao" },
      { nome: "Vale do Itajaí (Blumenau)", slug: "vale-do-itajai" },
      { nome: "Norte de Santa Catarina (Joinville)", slug: "norte-de-santa-catarina" },
      { nome: "Oeste de Santa Catarina (Chapecó)", slug: "oeste-de-santa-catarina" },
      { nome: "Sul de Santa Catarina (Criciúma)", slug: "sul-de-santa-catarina" }
    ]
  },
  SP: {
    nome: "São Paulo",
    slug: "estado-sp",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "São Paulo e região", slug: "sao-paulo-e-regiao" },
      { nome: "Campinas e região", slug: "regiao-de-campinas" },
      { nome: "Baixada Santista e Litoral Sul", slug: "baixada-santista-e-litoral-sul" },
      { nome: "Vale do Paraíba e Litoral Norte", slug: "vale-do-paraiba-e-litoral-norte" },
      { nome: "Sorocaba e região", slug: "regiao-de-sorocaba" },
      { nome: "Ribeirão Preto e região", slug: "regiao-de-ribeirao-preto" },
      { nome: "São José do Rio Preto e região", slug: "regiao-de-sao-jose-do-rio-preto" },
      { nome: "Bauru, Marília e região", slug: "regiao-de-bauru-e-marilia" },
      { nome: "Presidente Prudente e região", slug: "regiao-de-presidente-prudente" }
    ]
  },
  SE: {
    nome: "Sergipe",
    slug: "estado-se",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Aracaju e região", slug: "aracaju-e-regiao" }
    ]
  },
  TO: {
    nome: "Tocantins",
    slug: "estado-to",
    regioes: [
      { nome: "Todo o Estado", slug: "" },
      { nome: "Palmas e região", slug: "palmas-e-regiao" }
    ]
  }
};

export const LISTA_ESTADOS = [
  { uf: "BR", nome: "Brasil Inteiro (Todas as Regiões)", slug: "brasil" },
  ...Object.keys(OLX_ESTADOS)
    .filter(uf => uf !== "BR")
    .map(uf => ({
      uf,
      nome: OLX_ESTADOS[uf].nome,
      slug: OLX_ESTADOS[uf].slug
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
];

export function gerarUrlOlx(uf, regiaoSlug, termo) {
  let base = "https://www.olx.com.br/";
  if (uf === "BR" || uf === "BRASIL") {
    base += "brasil";
  } else {
    const estado = OLX_ESTADOS[uf];
    if (!estado) return "https://www.olx.com.br/brasil?sf=1";

    if (uf === "DF") {
      base += "distrito-federal-e-regiao";
    } else if (regiaoSlug) {
      base += `${estado.slug}/${regiaoSlug}`;
    } else {
      base += estado.slug;
    }
  }

  const queryParams = ["sf=1"];
  if (termo && termo.trim()) {
    queryParams.push(`q=${encodeURIComponent(termo.trim().toLowerCase())}`);
  }

  return `${base}?${queryParams.join("&")}`;
}

// =====================================================================
// DADOS DE REGIÕES E CIDADES DO FACEBOOK MARKETPLACE BRASIL
// =====================================================================

export const FACEBOOK_ESTADOS_CIDADES = {
  BR: {
    nome: "Brasil Inteiro (Todas as Regiões)",
    cidades: [
      { nome: "Todas as Cidades", slug: "brasil" }
    ]
  },
  AC: {
    nome: "Acre",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Rio Branco", slug: "riobranco" },
      { nome: "Cruzeiro do Sul", slug: "cruzeirodosul" }
    ]
  },
  AL: {
    nome: "Alagoas",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Maceió e Região", slug: "maceio" },
      { nome: "Arapiraca", slug: "arapiraca" }
    ]
  },
  AP: {
    nome: "Amapá",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Macapá", slug: "macapa" },
      { nome: "Santana", slug: "santana" }
    ]
  },
  AM: {
    nome: "Amazonas",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Manaus e Região", slug: "manaus" },
      { nome: "Parintins", slug: "parintins" }
    ]
  },
  BA: {
    nome: "Bahia",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Salvador e Região", slug: "salvador" },
      { nome: "Feira de Santana", slug: "feiradesantana" },
      { nome: "Vitória da Conquista", slug: "vitoriadaconquista" },
      { nome: "Itabuna e Ilhéus", slug: "itabuna" }
    ]
  },
  CE: {
    nome: "Ceará",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Fortaleza e Região", slug: "fortaleza" },
      { nome: "Juazeiro do Norte", slug: "juazeirodonorte" },
      { nome: "Sobral", slug: "sobral" }
    ]
  },
  DF: {
    nome: "Distrito Federal",
    cidades: [
      { nome: "Todo o Distrito Federal", slug: "brasilia" },
      { nome: "Brasília e Região", slug: "brasilia" }
    ]
  },
  ES: {
    nome: "Espírito Santo",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Vitória e Região", slug: "vitoria" },
      { nome: "Vila Velha", slug: "vilavelha" },
      { nome: "Serra", slug: "serra" },
      { nome: "Cachoeiro de Itapemirim", slug: "cachoeirodeitapemirim" }
    ]
  },
  GO: {
    nome: "Goiás",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Goiânia e Região", slug: "goiania" },
      { nome: "Aparecida de Goiânia", slug: "aparecidadegoiania" },
      { nome: "Anápolis", slug: "anapolis" },
      { nome: "Rio Verde", slug: "rioverde" }
    ]
  },
  MA: {
    nome: "Maranhão",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "São Luís e Região", slug: "saoluis" },
      { nome: "Imperatriz", slug: "imperatriz" }
    ]
  },
  MT: {
    nome: "Mato Grosso",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Cuiabá e Região", slug: "cuiaba" },
      { nome: "Várzea Grande", slug: "varzeagrande" },
      { nome: "Rondonópolis", slug: "rondonopolis" }
    ]
  },
  MS: {
    nome: "Mato Grosso do Sul",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Campo Grande e Região", slug: "campogrande" },
      { nome: "Dourados", slug: "dourados" },
      { nome: "Três Lagoas", slug: "treslagoas" }
    ]
  },
  MG: {
    nome: "Minas Gerais",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Belo Horizonte e Região", slug: "belohorizonte" },
      { nome: "Uberlândia", slug: "uberlandia" },
      { nome: "Contagem", slug: "contagem" },
      { nome: "Juiz de Fora", slug: "juizdefora" },
      { nome: "Betim", slug: "betim" },
      { nome: "Montes Claros", slug: "montesclaros" }
    ]
  },
  PA: {
    nome: "Pará",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Belém e Região", slug: "belem" },
      { nome: "Ananindeua", slug: "ananindeua" },
      { nome: "Santarém", slug: "santarem" }
    ]
  },
  PB: {
    nome: "Paraíba",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "João Pessoa e Região", slug: "joaopessoa" },
      { nome: "Campina Grande", slug: "campinagrande" }
    ]
  },
  PR: {
    nome: "Paraná",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Curitiba e Região", slug: "curitiba" },
      { nome: "Londrina", slug: "londrina" },
      { nome: "Maringá", slug: "maringa" },
      { nome: "Ponta Grossa", slug: "pontagrossa" },
      { nome: "Cascavel", slug: "cascavel" },
      { nome: "Foz do Iguaçu", slug: "fozdoiguacu" }
    ]
  },
  PE: {
    nome: "Pernambuco",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Recife e Região", slug: "recife" },
      { nome: "Jaboatão dos Guararapes", slug: "jaboataodosguararapes" },
      { nome: "Olinda", slug: "olinda" },
      { nome: "Caruaru", slug: "caruaru" },
      { nome: "Petrolina", slug: "petrolina" }
    ]
  },
  PI: {
    nome: "Piauí",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Teresina e Região", slug: "teresina" },
      { nome: "Parnaíba", slug: "parnaiba" }
    ]
  },
  RJ: {
    nome: "Rio de Janeiro",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Rio de Janeiro e Região", slug: "riodejaneiro" },
      { nome: "Niterói / São Gonçalo", slug: "niteroi" },
      { nome: "Duque de Caxias / Baixada", slug: "duquedecaxias" },
      { nome: "Nova Iguaçu", slug: "novaiguacu" },
      { nome: "Campos dos Goytacazes", slug: "camposdosgoytacazes" },
      { nome: "Petrópolis / Região Serrana", slug: "petropolis" }
    ]
  },
  RN: {
    nome: "Rio Grande do Norte",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Natal e Região", slug: "natal" },
      { nome: "Mossoró", slug: "mossoro" }
    ]
  },
  RS: {
    nome: "Rio Grande do Sul",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Porto Alegre e Região", slug: "portoalegre" },
      { nome: "Caxias do Sul", slug: "caxiasdosul" },
      { nome: "Pelotas", slug: "pelotas" },
      { nome: "Canoas", slug: "canoas" },
      { nome: "Santa Maria", slug: "santamaria" }
    ]
  },
  RO: {
    nome: "Rondônia",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Porto Velho", slug: "portovelho" },
      { nome: "Ji-Paraná", slug: "jiparana" }
    ]
  },
  RR: {
    nome: "Roraima",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Boa Vista", slug: "boavista" }
    ]
  },
  SC: {
    nome: "Santa Catarina",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Florianópolis e Região", slug: "florianopolis" },
      { nome: "Joinville", slug: "joinville" },
      { nome: "Blumenau", slug: "blumenau" },
      { nome: "São José", slug: "saojose" },
      { nome: "Chapecó", slug: "chapeco" },
      { nome: "Itajaí / Balneário Camboriú", slug: "itajai" }
    ]
  },
  SP: {
    nome: "São Paulo",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "São Paulo e Região", slug: "saopaulo" },
      { nome: "Campinas e Região", slug: "campinas" },
      { nome: "Guarulhos", slug: "guarulhos" },
      { nome: "São Bernardo do Campo", slug: "saobernardodocampo" },
      { nome: "Santo André", slug: "santoandre" },
      { nome: "Osasco", slug: "osasco" },
      { nome: "São José dos Campos", slug: "saojosedoscampos" },
      { nome: "Ribeirão Preto", slug: "ribeiraopreto" },
      { nome: "Sorocaba", slug: "sorocaba" },
      { nome: "Santos e Baixada Santista", slug: "santos" }
    ]
  },
  SE: {
    nome: "Sergipe",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Aracaju e Região", slug: "aracaju" },
      { nome: "Nossa Senhora do Socorro", slug: "socorro" }
    ]
  },
  TO: {
    nome: "Tocantins",
    cidades: [
      { nome: "Todo o Estado", slug: "brasil" },
      { nome: "Palmas", slug: "palmas" },
      { nome: "Araguaína", slug: "araguaina" }
    ]
  }
};

export const LISTA_ESTADOS_FACEBOOK = [
  { uf: "BR", nome: "Brasil Inteiro (Todas as Regiões)" },
  ...Object.keys(FACEBOOK_ESTADOS_CIDADES)
    .filter(uf => uf !== "BR")
    .map(uf => ({
      uf,
      nome: FACEBOOK_ESTADOS_CIDADES[uf].nome
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
];

export const FACEBOOK_REGIOES = [
  { nome: "Brasil Inteiro (Todas as Regiões)", slug: "brasil" },
  { nome: "São Paulo e Região, SP", slug: "saopaulo" },
  { nome: "Rio de Janeiro e Região, RJ", slug: "riodejaneiro" },
  { nome: "Belo Horizonte e Região, MG", slug: "belohorizonte" },
  { nome: "Curitiba e Região, PR", slug: "curitiba" },
  { nome: "Porto Alegre e Região, RS", slug: "portoalegre" },
  { nome: "Salvador e Região, BA", slug: "salvador" },
  { nome: "Fortaleza e Região, CE", slug: "fortaleza" },
  { nome: "Brasília e Região, DF", slug: "brasilia" },
  { nome: "Recife e Região, PE", slug: "recife" },
  { nome: "Goiânia e Região, GO", slug: "goiania" },
  { nome: "Manaus e Região, AM", slug: "manaus" },
  { nome: "Belém e Região, PA", slug: "belem" },
  { nome: "Campinas e Região, SP", slug: "campinas" },
  { nome: "Florianópolis e Região, SC", slug: "florianopolis" },
  { nome: "Vitória e Região, ES", slug: "vitoria" },
  { nome: "Natal e Região, RN", slug: "natal" },
  { nome: "Campo Grande e Região, MS", slug: "campogrande" },
  { nome: "Cuiabá e Região, MT", slug: "cuiaba" },
  { nome: "João Pessoa e Região, PB", slug: "joaopessoa" },
  { nome: "Maceió e Região, AL", slug: "maceio" },
  { nome: "Teresina e Região, PI", slug: "teresina" },
  { nome: "Aracaju e Região, SE", slug: "aracaju" }
];

export function gerarUrlFacebook(cidadeSlug = "brasil", termo = "") {
  const cSlug = (!cidadeSlug || cidadeSlug === "brasil") ? "" : `${cidadeSlug}/`;
  const q = termo ? `?query=${encodeURIComponent(termo.trim().toLowerCase())}` : "";
  return `https://www.facebook.com/marketplace/${cSlug}search/${q}`;
}

