/**
 * Dados Oficiais dos 10 Departamentos da Pesquisa Inteligente
 * Cada departamento possui imagens locais em alta resolução e subprodutos específicos
 * para enriquecer e direcionar a escolha do usuário sem necessidade de digitação.
 */

export const DEPARTAMENTOS_PESQUISA = [
  {
    key: 'games',
    label: 'Games & Consoles',
    descricao: 'Consoles de última geração, acessórios e jogos',
    icon: 'game-controller',
    tagColor: '#8B5CF6',
    query: 'PlayStation 5',
    image: require('./assets/categories/cat_games.jpg'),
    subcategorias: [
      { key: 'ps5', label: 'PlayStation 5', query: 'PlayStation 5', image: require('./assets/categories/sub_ps5.jpg') },
      { key: 'ps4', label: 'PlayStation 4', query: 'PlayStation 4', image: require('./assets/categories/sub_ps4.jpg') },
      { key: 'xbox', label: 'Xbox Series S / X', query: 'Xbox Series', image: require('./assets/categories/sub_xbox.jpg') },
      { key: 'switch', label: 'Nintendo Switch', query: 'Nintendo Switch', image: require('./assets/categories/sub_switch.jpg') },
      { key: 'controle', label: 'Controle Sem Fio', query: 'Joystick de Console', image: require('./assets/categories/sub_controle_gamer.jpg') },
      { key: 'jogos', label: 'Jogos em Mídia Física', query: 'Game Mídia Física', image: require('./assets/categories/sub_jogos.jpg') },
      { key: 'cadeira', label: 'Cadeira Gamer', query: 'Cadeira Gamer', image: require('./assets/categories/sub_cadeira_gamer.jpg') },
    ]
  },
  {
    key: 'informatica',
    label: 'Informática & PC',
    descricao: 'Notebooks, peças de alto desempenho e periféricos',
    icon: 'laptop',
    tagColor: '#3B82F6',
    query: 'Notebook',
    image: require('./assets/categories/cat_informatica.jpg'),
    subcategorias: [
      { key: 'notebook', label: 'Notebooks', query: 'Notebook', image: require('./assets/categories/sub_notebook.jpg') },
      { key: 'gpu', label: 'Placa de Vídeo (GPU)', query: 'Placa de Vídeo', image: require('./assets/categories/sub_placa_video.jpg') },
      { key: 'ram', label: 'Memória RAM', query: 'Memória RAM', image: require('./assets/categories/sub_memoria_ram.jpg') },
      { key: 'ssd', label: 'SSD NVMe M.2', query: 'SSD NVMe', image: require('./assets/categories/sub_ssd.jpg') },
      { key: 'cpu', label: 'Processadores', query: 'Processador de PC', image: require('./assets/categories/sub_processador.jpg') },
      { key: 'mobo', label: 'Placa-Mãe', query: 'Placa Mãe de PC', image: require('./assets/categories/sub_placa_mae.jpg') },
      { key: 'monitor', label: 'Monitor Gamer 144Hz+', query: 'Monitor Gamer', image: require('./assets/categories/sub_monitor.jpg') },
      { key: 'perifericos', label: 'Teclado & Mouse', query: 'Kit Teclado e Mouse', image: require('./assets/categories/sub_teclado_mouse.jpg') },
    ]
  },
  {
    key: 'telefonia',
    label: 'Telefonia & Celulares',
    descricao: 'Smartphones modernos, smartwatches e acessórios',
    icon: 'phone-portrait',
    tagColor: '#10B981',
    query: 'Smartphone',
    image: require('./assets/categories/cat_telefonia.jpg'),
    subcategorias: [
      { key: 'iphone', label: 'Apple iPhone', query: 'iPhone 256gb', image: require('./assets/categories/sub_iphone.jpg') },
      { key: 'samsung', label: 'Samsung', query: 'Samsung Galaxy 256gb', image: require('./assets/categories/sub_samsung_galaxy.jpg') },
      { key: 'xiaomi', label: 'Xiaomi', query: 'Xiaomi Redmi 256gb', image: require('./assets/categories/sub_xiaomi.jpg') },
      { key: 'motorola', label: 'Motorola Edge & Moto G', query: 'Motorola Moto G 256gb', image: require('./assets/categories/sub_motorola.jpg') },
      { key: 'smartwatch', label: 'Smartwatch & Band', query: 'Smartwatch Relógio Inteligente', image: require('./assets/categories/sub_smartwatch.jpg') },
      { key: 'carregador', label: 'Carregador & Indução', query: 'Carregador Rápido Indução', image: require('./assets/categories/sub_carregador.jpg') },
    ]
  },
  {
    key: 'televisao',
    label: 'Televisão & Áudio',
    descricao: 'Smart TVs 4K, soundbars potentes e fones bluetooth',
    icon: 'tv',
    tagColor: '#EC4899',
    query: 'Smart TV',
    image: require('./assets/categories/cat_televisao.jpg'),
    subcategorias: [
      { key: 'smart_tv', label: 'Smart TV 4K UHD', query: 'Smart TV 4K', image: require('./assets/categories/sub_smart_tv_4k.jpg') },
      { key: 'tv_55', label: 'TV 55 Polegadas', query: 'Smart TV 55 Polegadas', image: require('./assets/categories/sub_tv_55.jpg') },
      { key: 'tv_65', label: 'TV 65 Polegadas', query: 'Smart TV 65 Polegadas', image: require('./assets/categories/sub_tv_65.jpg') },
      { key: 'soundbar', label: 'Soundbar Subwoofer', query: 'Soundbar Bluetooth', image: require('./assets/categories/sub_soundbar.jpg') },
      { key: 'caixa_som', label: 'Caixa de Som Bluetooth', query: 'Caixa de Som Bluetooth Portátil', image: require('./assets/categories/sub_caixa_bluetooth.jpg') },
      { key: 'fone_tws', label: 'Fones Sem Fio TWS', query: 'Fone de Ouvido Bluetooth Sem Fio', image: require('./assets/categories/sub_fone_tws.jpg') },
      { key: 'tv_box', label: 'TV Stick & TV Box 4K', query: 'Fire TV Stick 4K TV box', image: require('./assets/categories/sub_tv_box.jpg') },
    ]
  },
  {
    key: 'eletroportateis',
    label: 'Eletroportáteis',
    descricao: 'Praticidade para a cozinha e limpeza inteligente',
    icon: 'cafe',
    tagColor: '#F59E0B',
    query: 'Air Fryer',
    image: require('./assets/categories/cat_eletroportateis.jpg'),
    subcategorias: [
      { key: 'airfryer', label: 'Fritadeira Air Fryer', query: 'Air Fryer', image: require('./assets/categories/sub_airfryer.jpg') },
      { key: 'cafeteira', label: 'Cafeteira Expresso', query: 'Cafeteira', image: require('./assets/categories/sub_cafeteira.jpg') },
      { key: 'liquidificador', label: 'Liquidificador Potente', query: 'Liquidificador', image: require('./assets/categories/sub_liquidificador.jpg') },
      { key: 'aspirador_robo', label: 'Aspirador Robô', query: 'Aspirador de Pó Robô', image: require('./assets/categories/sub_aspirador_robo.jpg') },
      { key: 'sanduicheira', label: 'Sanduicheira & Grill', query: 'Sanduicheira Grill Elétrico', image: require('./assets/categories/sub_sanduicheira.jpg') },
      { key: 'batedeira', label: 'Batedeira Planetária', query: 'Batedeira Planetária', image: require('./assets/categories/sub_batedeira.jpg') },
    ]
  },
  {
    key: 'eletrodomesticos',
    label: 'Eletrodomésticos',
    descricao: 'Geladeiras, lavadoras, fogões e cozinhas completas',
    icon: 'cube',
    tagColor: '#06B6D4',
    query: 'Geladeira Frost Free',
    image: require('./assets/categories/cat_eletrodomesticos.jpg'),
    subcategorias: [
      { key: 'geladeira', label: 'Geladeira Frost Free', query: 'Geladeira Frost Free', image: require('./assets/categories/sub_geladeira.jpg') },
      { key: 'maquina_lavar', label: 'Máquina de Lavar', query: 'Máquina de Lavar Roupas', image: require('./assets/categories/sub_maquina_lavar.jpg') },
      { key: 'lava_seca', label: 'Lava e Seca', query: 'Lava e Seca Inverter', image: require('./assets/categories/sub_lava_seca.jpg') },
      { key: 'fogao', label: 'Fogão & Cooktop', query: 'Fogão Cooktop 4 5 Bocas', image: require('./assets/categories/sub_fogao.jpg') },
      { key: 'microondas', label: 'Micro-ondas', query: 'Forno Micro-ondas', image: require('./assets/categories/sub_microondas.jpg') },
      { key: 'lava_loucas', label: 'Lava-Louças', query: 'Lava-Louças Inox', image: require('./assets/categories/sub_lava_loucas.jpg') },
    ]
  },
  {
    key: 'ar_ventilacao',
    label: 'Ar e Ventilação',
    descricao: 'Ar-condicionado econômico, ventiladores e climatizadores',
    icon: 'snow',
    tagColor: '#0284C7',
    query: 'Ar Condicionado Inverter',
    image: require('./assets/categories/cat_ar_ventilacao.jpg'),
    subcategorias: [
      { key: 'ar_inverter', label: 'Ar-Condicionado', query: 'Ar Condicionado Split', image: require('./assets/categories/sub_ar_inverter.jpg') },
      { key: 'ventilador', label: 'Ventilador Mesa / Coluna', query: 'Ventilador Turbo Silencioso', image: require('./assets/categories/sub_ventilador.jpg') },
      { key: 'climatizador', label: 'Climatizador de Ar', query: 'Climatizador de Ar', image: require('./assets/categories/sub_climatizador.jpg') },
      { key: 'umidificador', label: 'Umidificador de Ar', query: 'Umidificador de Ar', image: require('./assets/categories/sub_umidificador.jpg') },
      { key: 'ventilador_teto', label: 'Ventilador de Teto', query: 'Ventilador de Teto', image: require('./assets/categories/sub_ventilador_teto.jpg') },
    ]
  },
  {
    key: 'moda_beleza',
    label: 'Moda e Beleza',
    descricao: 'Perfumes importados, calçados e cosméticos',
    icon: 'color-palette',
    tagColor: '#D946EF',
    query: 'Perfume Importado',
    image: require('./assets/categories/cat_moda_beleza.jpg'),
    subcategorias: [
      { key: 'perfume', label: 'Perfumes Importados', query: 'Perfume Importado Masculino Feminino', image: require('./assets/categories/sub_perfume.jpg') },
      { key: 'tenis_masc', label: 'Tênis Masculino', query: 'Tênis Masculino', image: require('./assets/categories/sub_tenis_masc.jpg') },
      { key: 'tenis_fem', label: 'Tênis Feminino', query: 'Tênis Feminino Confortável', image: require('./assets/categories/sub_tenis_fem.jpg') },
      { key: 'relogio', label: 'Relógios de Pulso', query: 'Relógio Masculino Feminino', image: require('./assets/categories/sub_relogio.jpg') },
      { key: 'maquiagem', label: 'Maquiagem & Skincare', query: 'Kit Maquiagem Skincare', image: require('./assets/categories/sub_maquiagem.jpg') },
      { key: 'bolsa', label: 'Bolsas Femininas', query: 'Bolsa Feminina', image: require('./assets/categories/sub_bolsa.jpg') },
    ]
  },
  {
    key: 'cama_mesa_banho',
    label: 'Cama, Mesa e Banho',
    descricao: 'Conforto e elegância para o seu lar',
    icon: 'bed',
    tagColor: '#EA580C',
    query: 'Jogo de Cama',
    image: require('./assets/categories/cat_cama_mesa_banho.jpg'),
    subcategorias: [
      { key: 'jogo_cama', label: 'Jogo de Cama Casal/Queen', query: 'Jogo de Cama Casal', image: require('./assets/categories/sub_jogo_cama.jpg') },
      { key: 'toalha', label: 'Jogo de Toalhas de Banho', query: 'Toalha de Banho', image: require('./assets/categories/sub_toalha_banho.jpg') },
      { key: 'edredom', label: 'Edredom & Cobertor', query: 'Edredom Casal Queen Macio', image: require('./assets/categories/sub_edredom.jpg') },
      { key: 'travesseiro', label: 'Travesseiro Viscoelástico', query: 'Travesseiro Nasa Ortopédico', image: require('./assets/categories/sub_travesseiro.jpg') },
      { key: 'cortina', label: 'Cortinas Blackout', query: 'Cortina Blackout Quarto Sala', image: require('./assets/categories/sub_cortina.jpg') },
    ]
  },
  {
    key: 'esporte_lazer',
    label: 'Esporte & Lazer',
    descricao: 'Bicicletas, suplementos e itens de treino',
    icon: 'fitness',
    tagColor: '#EAB308',
    query: 'Bicicleta',
    image: require('./assets/categories/cat_esporte_lazer.jpg'),
    subcategorias: [
      { key: 'bicicleta', label: 'Bicicleta Aro 29', query: 'Bicicleta Aro 29', image: require('./assets/categories/sub_bicicleta.jpg') },
      { key: 'suplementos', label: 'Whey Protein & Creatina', query: 'Whey Protein Creatina 100% Pura', image: require('./assets/categories/sub_suplementos.jpg') },
      { key: 'esteira', label: 'Esteira & Aparelhos', query: 'Esteira Elétrica Ergométrica', image: require('./assets/categories/sub_esteira.jpg') },
      { key: 'tenis_corrida', label: 'Tênis de Alta Performance', query: 'Tênis de Corrida Amortecimento', image: require('./assets/categories/sub_tenis_corrida.jpg') },
      { key: 'garrafa', label: 'Garrafas & Copos Térmicos', query: 'Copo Térmico Garrafa Inox', image: require('./assets/categories/sub_garrafa_termica.jpg') },
    ]
  }
];
