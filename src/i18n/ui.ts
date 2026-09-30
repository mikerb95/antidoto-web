// Textos de interfaz por idioma. El contenido de servicios vive en src/data/servicios.ts.
// Regla: todo texto nuevo va en los dos idiomas y sin guiones largos ni semilargos.

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Páginas del sitio y su ruta en cada idioma. */
export const PAGINAS = ['inicio', 'servicios', 'clientes', 'nosotros', 'contacto'] as const;
export type Pagina = (typeof PAGINAS)[number];

export const rutas: Record<Pagina, Record<Locale, string>> = {
  inicio: { es: '/', en: '/en/' },
  servicios: { es: '/servicios/', en: '/en/services/' },
  clientes: { es: '/clientes/', en: '/en/clients/' },
  nosotros: { es: '/nosotros/', en: '/en/about/' },
  contacto: { es: '/contacto/', en: '/en/contact/' },
};

/** Política de tratamiento de datos (fuera del menú, enlazada en el pie y el cotizador). */
export const rutaPolitica: Record<Locale, string> = { es: '/politica-de-datos/', en: '/en/data-policy/' };

/** Ruta de la home de cada idioma. */
export const homePath: Record<Locale, string> = { es: rutas.inicio.es, en: rutas.inicio.en };

export const ui = {
  es: {
    htmlLang: 'es-CO',
    ogLocale: 'es_CO',
    skip: 'Saltar al contenido',
    nav: { servicios: 'Servicios', clientes: 'Clientes', nosotros: 'Nosotros', contacto: 'Contacto' },
    navQuote: 'Cotizar',
    menuLabel: 'Principal',
    menuOpen: 'Abrir menú',
    menuClose: 'Cerrar menú',
    homeLabel: 'Antídoto, inicio',
    langLabel: 'Idioma',
    switchLangLabel: 'Ver el sitio en inglés',
    waFab: 'Escríbenos por WhatsApp',

    estado: 'Atendiendo',
    ubicacion: 'Colombia',
    idiomas: 'ES · PT · EN',
    insignias: ['Especialistas en SST', '+200 eventos a nivel nacional'],
    heroTitle: ['Creamos experiencias que ', 'conectan', ', ', 'inspiran', ' y ', 'transforman'],
    heroLead:
      'Formaciones vivenciales, producción audiovisual y catering corporativo para empresas, colegios y organizaciones.',
    heroCta: 'Cotizar por WhatsApp',
    heroSecondary: 'Ver servicios',
    serviciosCortos: ['Formaciones', 'Audiovisual', 'Catering', 'Diseño'],
    serviciosLabel: 'Servicios',
    visorLabel: 'Visor de trabajos reales',
    visorFicha: 'Fórmula',
    horaLabel: 'Hora local',
    horaZona: 'Colombia · GMT-5',
    dosisLabel: 'La fórmula',
    dosisTexto: '4 servicios, un mismo estándar',
    waCardLabel: 'Cotización',
    waCardTexto: 'Escríbenos y armamos tu propuesta',
    pause: 'Pausar animación',
    resume: 'Reanudar animación',
    stats: [
      ['+150', 'producciones'],
      ['+200', 'eventos'],
      ['+50', 'clientes'],
      ['3', 'idiomas'],
      ['2020', 'desde'],
    ],

    hud: { titulo: 'Fórmula', base: 'base', mezcla: 'mezcla', reaccion: 'reacción', muestra: 'muestra', dosis: 'dosis' },

    servicesKicker: 'Qué hacemos',
    servicesTitle: 'Cuatro servicios, una sola fórmula',
    servicesLead: 'Para talento humano, SST, comunicaciones internas, bienestar y rectorías.',
    servicesAll: 'Ver todos los servicios',
    serviceMore: 'Ver servicio',
    servicioCols: ['Servicio', 'Qué incluye', 'Datos'],
    provisional: 'Foto provisional',

    retosKicker: 'El antídoto',
    retosTitle: 'Convertimos tus retos en soluciones',
    retosLead:
      'En Antídoto convertimos tus retos en soluciones efectivas: propuestas prácticas, creativas e innovadoras que generan resultados reales.',
    retosLabel: 'Retos',
    solucionesLabel: 'Soluciones',
    retos: ['Plazos encima', 'Logística', 'Presentaciones'],
    soluciones: ['Propuestas', 'Apoyo', 'Cumplimiento'],

    clientsKicker: 'Clientes',
    clientsTitle: 'Han confiado en nosotros',
    clientsLead: 'Energía, ingeniería, transporte, seguros y consultoría SST: marcas que trabajan con Antídoto.',
    clientsAll: 'Ver los 18 clientes',
    sectorsKicker: 'Por sector',
    sectorsTitle: 'Donde la seguridad y el detalle pesan',
    sectorsLead:
      'Buena parte de nuestros clientes trabaja en sectores donde una inducción o un plan de emergencia no pueden fallar.',
    sectors: {
      ingenieria: 'Energía e ingeniería',
      sst: 'Consultoría SST',
      seguros: 'Seguros',
      transporte: 'Transporte',
      otros: 'Otros sectores',
    },
    marcas: (n: number) => (n === 1 ? '1 marca' : `${n} marcas`),

    nosotrosKicker: 'Nosotros',
    nosotrosTitle: 'Un estudio creativo con criterio de ingeniería',
    nosotrosLead:
      'Antídoto nace en 2020 y hoy acompaña a organizaciones, colegios y universidades con proyectos que generan impacto real.',
    fundadoraKicker: 'Fundadora',
    fundadoraNombre: 'María Paula Ramos',
    fundadoraCargo: 'CEO y fundadora',
    fundadoraBio:
      'Ingeniera civil, especialista en Gerencia de SST. Lidera Antídoto acompañando a organizaciones, colegios y universidades con proyectos que generan impacto real.',
    fotoPendiente: 'Foto pendiente',
    historiaKicker: 'Historia',
    historiaTitle: 'De idea emergente a estudio creativo',
    historia: [
      ['2020', 'Idea emergente', 'Antídoto arranca como startup.'],
      ['2021', 'Transformación del modelo', 'El estudio redefine su forma de trabajar.'],
      ['2023', 'Consolidación', 'Se consolida en el mercado colombiano.'],
      ['Hoy', 'Estudio creativo empresarial', 'Formaciones, audiovisual, catering y diseño bajo un mismo estándar.'],
    ],

    contactoKicker: 'Contacto',
    contactoTitle: 'Cuéntanos tu reto',
    contactoLead: 'Arma tu cotización paso a paso y envíala por WhatsApp, o escríbenos por el canal que prefieras.',
    canalesKicker: 'Canales',
    canales: { whatsapp: 'WhatsApp', telefono: 'Teléfono', correo: 'Correo', instagram: 'Instagram', linkedin: 'LinkedIn' },
    cot: {
      titulo: 'Cotizador',
      pasos: ['Servicio', 'Detalles', 'Resumen'],
      paso: (n: number, total: number) => `Paso ${n} de ${total}`,
      servicioPregunta: '¿Qué servicio necesitas?',
      fecha: 'Fecha aproximada',
      personas: 'Número de personas',
      ciudad: 'Ciudad',
      tipo: 'Tipo de organización',
      tipos: ['Empresa', 'Colegio', 'Universidad', 'Otra organización'],
      opcional: 'opcional',
      siguiente: 'Siguiente',
      anterior: 'Atrás',
      enviar: 'Enviar por WhatsApp',
      resumenLead: 'Revisa el mensaje. Al enviarlo se abre WhatsApp con el texto listo.',
      mensaje: (d: { servicio: string; fecha: string; personas: string; ciudad: string; tipo: string }) =>
        [
          `Hola Antídoto, quiero cotizar ${d.servicio.toLowerCase()}.`,
          d.tipo && `Organización: ${d.tipo}.`,
          d.fecha && `Fecha aproximada: ${d.fecha}.`,
          d.personas && `Personas: ${d.personas}.`,
          d.ciudad && `Ciudad: ${d.ciudad}.`,
        ]
          .filter(Boolean)
          .join('\n'),
      privacidad:
        'No guardamos estos datos: el mensaje sale de tu navegador directo a WhatsApp.',
      privacidadApi: 'Solo guardamos tus datos si marcas la autorización. Sin ella, el mensaje sale directo a WhatsApp.',
      elegir: 'Elige un servicio para continuar.',
      pasoContacto: 'Contacto',
      contactoLegend: 'Tus datos para responderte',
      contactoLead: 'Opcional. Si nos autorizas, guardamos tu solicitud y te respondemos aunque no alcances a enviar el WhatsApp.',
      nombre: 'Nombre',
      empresa: 'Organización',
      correo: 'Correo',
      telefono: 'Teléfono o WhatsApp',
      verPolitica: 'Leer la política de tratamiento de datos',
      faltaContacto: 'Para guardar tu solicitud necesitamos tu nombre y un correo o teléfono válido.',
      guardado: 'Guardamos tu solicitud. Te escribimos pronto.',
      presentacion: (nombre: string, empresa: string) => `Soy ${nombre}${empresa ? `, de ${empresa}` : ''}.`,
    },

    ctaKicker: 'Siguiente paso',
    ctaTitle: 'Cuéntanos tu reto y te enviamos una propuesta',
    ctaCotizador: 'Armar cotización',
    ctaWhatsapp: 'WhatsApp',
    ctaEmail: 'Correo',
    waDefault: 'Hola Antídoto, quiero cotizar un servicio.',
    waService: (s: string) => `Hola Antídoto, quiero cotizar ${s.toLowerCase()}.`,
    serviceFor: 'Qué incluye',
    otherServices: 'Otros servicios',
    fichaServicio: 'Ficha del servicio',
    publico: 'Para',
    publicoTexto: 'Empresas, colegios, universidades y organizaciones',

    footerTagline: 'Estudio creativo empresarial en Colombia.',
    footerSitio: 'Sitio',
    footerServicios: 'Servicios',
    footerContacto: 'Contacto directo',
    footerRedes: 'Redes',
    footerEstado: 'Atendiendo en Colombia',
    footerPolitica: 'Tratamiento de datos',

    notFoundTitle: 'Esta página no existe',
    notFoundLead: 'Puede que el enlace esté mal escrito o que la página se haya movido.',
    notFoundCta: 'Volver al inicio',

    seo: {
      inicio: ['Antídoto | Formaciones, audiovisual y catering para empresas', 'Estudio creativo empresarial en Colombia: formaciones vivenciales, producción audiovisual, catering corporativo y diseño de experiencias para empresas.'],
      servicios: ['Servicios | Antídoto', 'Formaciones vivenciales, producción audiovisual, catering corporativo y diseño de productos y experiencias para empresas y colegios en Colombia.'],
      clientes: ['Clientes | Antídoto', 'Enel, Claro, Seguros Bolívar, WSP y otras 14 marcas de energía, ingeniería, transporte, seguros y SST trabajan con Antídoto.'],
      nosotros: ['Nosotros | Antídoto', 'Antídoto es un estudio creativo empresarial fundado en 2020 por María Paula Ramos, ingeniera civil especialista en Gerencia de SST.'],
      contacto: ['Contacto y cotización | Antídoto', 'Cotiza formaciones, producción audiovisual, catering o diseño en pocos pasos y recibe tu propuesta por WhatsApp.'],
    },
    ogAlt: 'Antídoto, estudio creativo empresarial',
  },
  en: {
    htmlLang: 'en',
    ogLocale: 'en_US',
    skip: 'Skip to content',
    nav: { servicios: 'Services', clientes: 'Clients', nosotros: 'About', contacto: 'Contact' },
    navQuote: 'Get a quote',
    menuLabel: 'Main',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    homeLabel: 'Antídoto, home',
    langLabel: 'Language',
    switchLangLabel: 'Ver el sitio en español',
    waFab: 'Message us on WhatsApp',

    estado: 'Available',
    ubicacion: 'Colombia',
    idiomas: 'ES · PT · EN',
    insignias: ['Health and safety specialists', '200+ events nationwide'],
    heroTitle: ['We create experiences that ', 'connect', ', ', 'inspire', ' and ', 'transform'],
    heroLead:
      'Experiential training, video production and corporate catering for companies, schools and organizations.',
    heroCta: 'Get a quote on WhatsApp',
    heroSecondary: 'See services',
    serviciosCortos: ['Training', 'Video', 'Catering', 'Design'],
    serviciosLabel: 'Services',
    visorLabel: 'Viewer of real work',
    visorFicha: 'Formula',
    horaLabel: 'Local time',
    horaZona: 'Colombia · GMT-5',
    dosisLabel: 'The formula',
    dosisTexto: '4 services, one standard',
    waCardLabel: 'Quote',
    waCardTexto: 'Message us and we will put together your proposal',
    pause: 'Pause animation',
    resume: 'Resume animation',
    stats: [
      ['150+', 'productions'],
      ['200+', 'events'],
      ['50+', 'clients'],
      ['3', 'languages'],
      ['2020', 'since'],
    ],

    hud: { titulo: 'Formula', base: 'base', mezcla: 'mix', reaccion: 'reaction', muestra: 'sample', dosis: 'dose' },

    servicesKicker: 'What we do',
    servicesTitle: 'Four services, one formula',
    servicesLead: 'For HR, health and safety, internal communications, wellbeing and school leaders.',
    servicesAll: 'See all services',
    serviceMore: 'See service',
    servicioCols: ['Service', 'What it includes', 'Facts'],
    provisional: 'Placeholder photo',

    retosKicker: 'The antidote',
    retosTitle: 'We turn your challenges into solutions',
    retosLead:
      'At Antídoto we turn your challenges into effective solutions: practical, creative and innovative proposals that deliver real results.',
    retosLabel: 'Challenges',
    solucionesLabel: 'Solutions',
    retos: ['Tight deadlines', 'Logistics', 'Presentations'],
    soluciones: ['Proposals', 'Support', 'Compliance'],

    clientsKicker: 'Clients',
    clientsTitle: 'Trusted by',
    clientsLead: 'Energy, engineering, transport, insurance and health and safety brands that work with Antídoto.',
    clientsAll: 'See all 18 clients',
    sectorsKicker: 'By sector',
    sectorsTitle: 'Where safety and detail matter',
    sectorsLead:
      'Many of our clients work in sectors where an onboarding session or an emergency plan cannot fail.',
    sectors: {
      ingenieria: 'Energy and engineering',
      sst: 'Health and safety consulting',
      seguros: 'Insurance',
      transporte: 'Transport',
      otros: 'Other sectors',
    },
    marcas: (n: number) => (n === 1 ? '1 brand' : `${n} brands`),

    nosotrosKicker: 'About',
    nosotrosTitle: 'A creative studio with an engineering mindset',
    nosotrosLead:
      'Antídoto was born in 2020 and today works with organizations, schools and universities on projects with real impact.',
    fundadoraKicker: 'Founder',
    fundadoraNombre: 'María Paula Ramos',
    fundadoraCargo: 'CEO and founder',
    fundadoraBio:
      'Civil engineer specialized in occupational health and safety management. She leads Antídoto, working with organizations, schools and universities on projects with real impact.',
    fotoPendiente: 'Photo pending',
    historiaKicker: 'History',
    historiaTitle: 'From emerging idea to creative studio',
    historia: [
      ['2020', 'Emerging idea', 'Antídoto starts as a startup.'],
      ['2021', 'New model', 'The studio redefines the way it works.'],
      ['2023', 'Consolidation', 'It consolidates in the Colombian market.'],
      ['Today', 'Creative studio for organizations', 'Training, video, catering and design under one standard.'],
    ],

    contactoKicker: 'Contact',
    contactoTitle: 'Tell us your challenge',
    contactoLead: 'Build your quote step by step and send it on WhatsApp, or reach us on the channel you prefer.',
    canalesKicker: 'Channels',
    canales: { whatsapp: 'WhatsApp', telefono: 'Phone', correo: 'Email', instagram: 'Instagram', linkedin: 'LinkedIn' },
    cot: {
      titulo: 'Quote builder',
      pasos: ['Service', 'Details', 'Summary'],
      paso: (n: number, total: number) => `Step ${n} of ${total}`,
      servicioPregunta: 'Which service do you need?',
      fecha: 'Approximate date',
      personas: 'Number of people',
      ciudad: 'City',
      tipo: 'Type of organization',
      tipos: ['Company', 'School', 'University', 'Other organization'],
      opcional: 'optional',
      siguiente: 'Next',
      anterior: 'Back',
      enviar: 'Send on WhatsApp',
      resumenLead: 'Check the message. Sending it opens WhatsApp with the text ready.',
      mensaje: (d: { servicio: string; fecha: string; personas: string; ciudad: string; tipo: string }) =>
        [
          `Hi Antídoto, I would like a quote for ${d.servicio.toLowerCase()}.`,
          d.tipo && `Organization: ${d.tipo}.`,
          d.fecha && `Approximate date: ${d.fecha}.`,
          d.personas && `People: ${d.personas}.`,
          d.ciudad && `City: ${d.ciudad}.`,
        ]
          .filter(Boolean)
          .join('\n'),
      privacidad: 'We do not store this data: the message goes from your browser straight to WhatsApp.',
      privacidadApi: 'We only store your details if you tick the authorization. Without it, the message goes straight to WhatsApp.',
      elegir: 'Choose a service to continue.',
      pasoContacto: 'Contact',
      contactoLegend: 'Your details so we can reply',
      contactoLead: 'Optional. If you authorize us, we keep your request and reply even if you do not get to send the WhatsApp message.',
      nombre: 'Name',
      empresa: 'Organization',
      correo: 'Email',
      telefono: 'Phone or WhatsApp',
      verPolitica: 'Read the data processing policy',
      faltaContacto: 'To keep your request we need your name and a valid email or phone.',
      guardado: 'We saved your request. We will be in touch soon.',
      presentacion: (nombre: string, empresa: string) => `I am ${nombre}${empresa ? `, from ${empresa}` : ''}.`,
    },

    ctaKicker: 'Next step',
    ctaTitle: 'Tell us your challenge and we will send you a proposal',
    ctaCotizador: 'Build a quote',
    ctaWhatsapp: 'WhatsApp',
    ctaEmail: 'Email',
    waDefault: 'Hi Antídoto, I would like a quote.',
    waService: (s: string) => `Hi Antídoto, I would like a quote for ${s.toLowerCase()}.`,
    serviceFor: 'What it includes',
    otherServices: 'Other services',
    fichaServicio: 'Service sheet',
    publico: 'For',
    publicoTexto: 'Companies, schools, universities and organizations',

    footerTagline: 'Creative studio for organizations in Colombia.',
    footerSitio: 'Site',
    footerServicios: 'Services',
    footerContacto: 'Direct contact',
    footerRedes: 'Social',
    footerEstado: 'Available in Colombia',
    footerPolitica: 'Data policy',

    notFoundTitle: 'This page does not exist',
    notFoundLead: 'The link may be mistyped or the page may have moved.',
    notFoundCta: 'Back to home',

    seo: {
      inicio: ['Antídoto | Training, video and catering for companies', 'Creative studio in Colombia: experiential training, video production, corporate catering and experience design for companies and schools.'],
      servicios: ['Services | Antídoto', 'Experiential training, video production, corporate catering and product and experience design for companies and schools in Colombia.'],
      clientes: ['Clients | Antídoto', 'Enel, Claro, Seguros Bolívar, WSP and 14 other energy, engineering, transport, insurance and safety brands work with Antídoto.'],
      nosotros: ['About | Antídoto', 'Antídoto is a creative studio founded in 2020 by María Paula Ramos, a civil engineer specialized in health and safety management.'],
      contacto: ['Contact and quote | Antídoto', 'Get a quote for training, video, catering or design in a few steps and receive your proposal on WhatsApp.'],
    },
    ogAlt: 'Antídoto, creative studio for organizations',
  },
} as const;

export function t(locale: Locale) {
  return ui[locale];
}

/** Ruta equivalente en el otro idioma. */
export function otroIdioma(locale: Locale): Locale {
  return locale === 'es' ? 'en' : 'es';
}
