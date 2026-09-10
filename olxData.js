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
