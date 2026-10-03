// Textos de las páginas internas del sitio multipágina (índices, líneas, ofertas, soluciones,
// portafolio, empresa, FAQ, blog, legales y mapa del sitio). Los textos comunes siguen en ui.ts.
// Regla: los dos idiomas, sin guiones largos ni semilargos, sin emojis. Lo que va entre
// corchetes es un dato que falta del cliente y se muestra en una caja .pendiente.
import type { Locale } from './ui';

export const paginas = {
  es: {
    inicio: 'Inicio',
    verTodo: 'Ver todo',
    verMas: 'Ver más',
    leerMas: 'Leer más',
    cotizar: 'Cotizar',
    submenu: (s: string) => `Abrir el submenú de ${s}`,
    todosServicios: 'Todos los servicios',
    todasSoluciones: 'Todas las soluciones',
    navEmpresa: 'La empresa',
    navRecursos: 'Recursos',
    descNav: {
      soluciones: 'Por área: SST, talento humano, comunicaciones y educación.',
      nosotros: 'Quiénes somos y de dónde venimos.',
      comoTrabajamos: 'Tres pasos, del reto al informe final.',
      clientes: 'Marcas que han trabajado con nosotros.',
      trabaja: 'Alianzas y talento.',
      faq: 'Cobertura, idiomas, entregas y cotización.',
      blog: 'Ideas para formar y cuidar a tu equipo.',
      portafolio: 'Proyectos reales, contados de principio a fin.',
    },

    cta: {
      titulo: 'Cuéntanos tu reto y te enviamos una propuesta',
      lead: 'Arma tu cotización en tres pasos o escríbenos directo por WhatsApp.',
      cotizador: 'Armar cotización',
      whatsapp: 'Escribir por WhatsApp',
    },

    servicios: {
      titulo: ['Cuatro líneas, ', 'una sola fórmula'],
      lead: 'Formaciones, producción audiovisual, catering y diseño para empresas, colegios y universidades. Se contratan por separado o como un solo evento.',
      ofertasDe: (n: number) => (n === 1 ? '1 oferta' : `${n} ofertas`),
      verLinea: 'Ver la línea',
      combinar: ['¿Necesitas más de una línea?', 'Un solo equipo coordina formación, video, comida y piezas para el mismo evento.', 'Ver cómo trabajamos'],
    },

    linea: {
      ofertas: ['Qué ', 'ofrecemos'],
      ofertasLead: 'Cada oferta tiene su página con el detalle. Elige la que se parece a tu reto.',
      paraQuien: ['Para ', 'quién'],
      paraQuienLead: 'Las áreas que más contratan esta línea.',
      casos: ['Casos de ', 'esta línea'],
      casoPendiente: '[CASO REAL DE ESTA LÍNEA: cliente, reto, solución y resultado validado]',
      faq: ['Preguntas ', 'frecuentes'],
      otras: ['Otras ', 'líneas'],
      datos: 'En cifras',
      detallePendiente: '[DESCRIPCIÓN LARGA DE LA LÍNEA: metodología, formatos y diferenciales]',
      verOferta: 'Ver oferta',
    },

    oferta: {
      para: 'Para',
      incluye: ['Qué ', 'incluye'],
      incluyePendiente: '[QUÉ INCLUYE: entregables, formato y duración]',
      detallePendiente: '[DESCRIPCIÓN DETALLADA: cómo se hace, cuánto dura y qué se lleva el cliente]',
      fotosPendiente: '[2 O 3 FOTOS DE ESTA OFERTA]',
      otras: (linea: string) => `Más de ${linea}`,
      soluciones: ['Recomendada ', 'para'],
      cotizarEsta: 'Cotizar esta oferta',
      wa: (oferta: string, linea: string) => `Hola Antídoto, quiero cotizar ${oferta.toLowerCase()} (${linea.toLowerCase()}).`,
    },

    soluciones: {
      titulo: ['Soluciones por ', 'área'],
      lead: 'Cada área llega con un reto distinto. Empieza por el tuyo y te mostramos lo que mejor funciona.',
      retos: ['Lo que ', 'resolvemos'],
      reto: 'El reto',
      solucion: 'Cómo lo resolvemos',
      ofertas: ['Lo que ', 'recomendamos'],
      clientes: 'Han confiado en nosotros',
      casoPendiente: '[CASO REAL DE ESTA ÁREA: empresa, reto y una cifra validada por el cliente]',
      educacionPendiente: '[RETOS TÍPICOS DE COLEGIOS Y UNIVERSIDADES, validados por el cliente]',
    },

    portafolio: {
      titulo: ['Nuestro ', 'trabajo'],
      lead: 'Proyectos reales de formación, video, catering y diseño, contados de principio a fin.',
      todos: 'Todos',
      vacio: '[CASOS DEL PORTAFOLIO: cliente con autorización, reto, solución, resultado y fotos]',
      vacioLead: 'Mientras publicamos los casos, mira las marcas que han trabajado con nosotros.',
      verClientes: 'Ver clientes',
      reto: 'El reto',
      solucion: 'Lo que hicimos',
      resultado: 'El resultado',
      cliente: 'Cliente',
      linea: 'Línea',
      otros: ['Más ', 'casos'],
    },

    nosotros: {
      empresa: ['Un estudio creativo con ', 'criterio de ingeniería'],
      datosTitulo: 'Antídoto en datos',
      equipo: ['Nuestro ', 'equipo'],
      seguir: ['Conoce ', 'más'],
    },

    como: {
      titulo: ['Así trabajamos ', 'contigo'],
      lead: 'Tres pasos, de la primera conversación al informe final. Un solo equipo responde por todo.',
      entregamos: ['Lo que ', 'te entregamos'],
      entregamosPendiente: '[ENTREGABLES AL CIERRE: registro, informe, evaluación o certificados según el servicio]',
      tiempos: ['Tiempos ', 'de respuesta'],
      tiemposPendiente: '[TIEMPO DE RESPUESTA A UNA COTIZACIÓN Y ANTICIPACIÓN RECOMENDADA POR SERVICIO]',
    },

    trabaja: {
      titulo: ['Trabaja ', 'con nosotros'],
      lead: 'Buscamos aliados que quieran sumar producción creativa a sus programas y talento que quiera crear con nosotros.',
      aliadosTitulo: ['Para ', 'aliados'],
      aliadosLead: 'Consultoras de SST, corredores de seguros, aseguradoras y agencias: sumamos nuestra producción a los programas de tus clientes.',
      aliadosPuntos: ['Formaciones y videos con tu marca o la de tu cliente', 'Un solo equipo para la producción y la logística', 'Cotización por proyecto'],
      aliadosWa: 'Hola Antídoto, quiero conversar sobre una alianza.',
      aliadosCta: 'Conversar sobre una alianza',
      talentoTitulo: ['Para ', 'talento'],
      talentoLead: 'Facilitadores, productores audiovisuales, cocina y diseño. Envíanos tu hoja de vida o portafolio por correo.',
      talentoAsunto: 'Hoja de vida para Antídoto',
      talentoCta: 'Enviar hoja de vida',
      vacantesPendiente: '[VACANTES ABIERTAS, si las hay]',
    },

    faq: {
      titulo: ['Preguntas ', 'frecuentes'],
      lead: 'Lo que más nos preguntan antes de cotizar. Si no encuentras tu respuesta, escríbenos.',
      temas: {
        general: 'Generales',
        formaciones: 'Formaciones',
        audiovisual: 'Producción audiovisual',
        catering: 'Catering',
        diseno: 'Diseño',
        cotizacion: 'Cotización',
      },
      indice: 'Temas',
      todas: 'Ver todas las preguntas',
      otra: ['¿Tienes otra pregunta?', 'Escríbenos y te respondemos por WhatsApp.'],
    },

    blog: {
      titulo: ['Ideas para ', 'tu equipo'],
      lead: 'Notas sobre SST, formación, video, eventos y cultura para quienes forman y cuidan a sus equipos.',
      categorias: { sst: 'SST', formacion: 'Formación', audiovisual: 'Audiovisual', eventos: 'Eventos', cultura: 'Cultura' },
      todas: 'Todas',
      vacio: '[PRIMEROS ARTÍCULOS DEL BLOG: temas y autor definidos con el cliente]',
      por: 'Por',
      relacionados: ['Servicios ', 'relacionados'],
      otros: ['Más ', 'artículos'],
      rss: 'Suscribirse por RSS',
      fecha: (d: Date) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }).format(d),
    },

    legal: {
      borrador: 'Borrador pendiente de revisión legal',
      actualizado: 'Última actualización',
      terminos: {
        titulo: 'Términos y condiciones',
        lead: 'Condiciones de uso de este sitio web.',
        secciones: [
          ['Quiénes somos', 'Este sitio pertenece a Antídoto. [RAZÓN SOCIAL, NIT Y DOMICILIO]'],
          ['Uso del sitio', 'El sitio informa sobre los servicios de Antídoto y permite pedir cotizaciones. Al usarlo te comprometes a no hacer un uso ilícito ni a afectar su funcionamiento.'],
          ['Cotizaciones', 'Las cotizaciones que armas en el sitio son una solicitud, no una oferta ni un contrato. Las condiciones de cada servicio se acuerdan por escrito en la propuesta.'],
          ['Propiedad intelectual', 'Los textos, fotos, videos, logos y el diseño del sitio son de Antídoto o de sus titulares. Las marcas de clientes se muestran con fines informativos.'],
          ['Enlaces a terceros', 'El sitio enlaza a WhatsApp, Instagram y LinkedIn. Cada servicio tiene sus propias condiciones.'],
          ['Datos personales', 'El tratamiento de datos se rige por la política de tratamiento de datos.'],
          ['Ley aplicable', '[LEY APLICABLE Y JURISDICCIÓN, a definir con el abogado]'],
        ],
      },
      cookies: {
        titulo: 'Cookies',
        lead: 'Qué guarda este sitio en tu navegador y para qué.',
        secciones: [
          ['Resumen', 'Este sitio no usa cookies de publicidad ni de seguimiento entre sitios.'],
          ['Lo que guardamos', 'Guardamos en tu navegador, solo durante la visita, de dónde llegaste (por ejemplo, una campaña) para saber qué canal funciona cuando pides una cotización. También guardamos copias de páginas para que el sitio funcione sin conexión.'],
          ['Medición', '[HERRAMIENTA DE MEDICIÓN, si se activa: por ejemplo, una sin cookies]'],
          ['Cómo borrarlo', 'Puedes borrar estos datos desde la configuración de tu navegador cuando quieras.'],
        ],
      },
    },

    mapa: {
      titulo: ['Mapa ', 'del sitio'],
      lead: 'Todas las páginas del sitio en un solo lugar.',
      grupos: { servicios: 'Servicios', soluciones: 'Soluciones', empresa: 'Empresa', recursos: 'Recursos', legal: 'Legal' },
    },

    noEncontrada: {
      lead: 'Puede que el enlace esté mal escrito o que la página se haya movido. Estas son las secciones del sitio:',
    },
  },

  en: {
    inicio: 'Home',
    verTodo: 'See all',
    verMas: 'See more',
    leerMas: 'Read more',
    cotizar: 'Get a quote',
    submenu: (s: string) => `Open the ${s} submenu`,
    todosServicios: 'All services',
    todasSoluciones: 'All solutions',
    navEmpresa: 'The company',
    navRecursos: 'Resources',
    descNav: {
      soluciones: 'By team: health and safety, HR, communications and education.',
      nosotros: 'Who we are and where we come from.',
      comoTrabajamos: 'Three steps, from challenge to final report.',
      clientes: 'Brands that have worked with us.',
      trabaja: 'Partnerships and talent.',
      faq: 'Coverage, languages, delivery and quotes.',
      blog: 'Ideas to train and care for your team.',
      portafolio: 'Real projects, told from start to finish.',
    },

    cta: {
      titulo: 'Tell us your challenge and we will send you a proposal',
      lead: 'Build your quote in three steps or message us directly on WhatsApp.',
      cotizador: 'Build a quote',
      whatsapp: 'Message us on WhatsApp',
    },

    servicios: {
      titulo: ['Four lines, ', 'one formula'],
      lead: 'Training, video production, catering and design for companies, schools and universities. Book them separately or as a single event.',
      ofertasDe: (n: number) => (n === 1 ? '1 offering' : `${n} offerings`),
      verLinea: 'See this line',
      combinar: ['Need more than one line?', 'One team coordinates training, video, food and pieces for the same event.', 'See how we work'],
    },

    linea: {
      ofertas: ['What we ', 'offer'],
      ofertasLead: 'Each offering has its own page with the details. Pick the one that looks like your challenge.',
      paraQuien: ['Who it is ', 'for'],
      paraQuienLead: 'The teams that book this line the most.',
      casos: ['Cases from ', 'this line'],
      casoPendiente: '[REAL CASE FROM THIS LINE: client, challenge, solution and validated result]',
      faq: ['Frequently asked ', 'questions'],
      otras: ['Other ', 'lines'],
      datos: 'In figures',
      detallePendiente: '[LONG DESCRIPTION OF THIS LINE: method, formats and differentiators]',
      verOferta: 'See offering',
    },

    oferta: {
      para: 'For',
      incluye: ['What is ', 'included'],
      incluyePendiente: '[WHAT IS INCLUDED: deliverables, format and duration]',
      detallePendiente: '[DETAILED DESCRIPTION: how it is done, how long it takes and what the client gets]',
      fotosPendiente: '[2 OR 3 PHOTOS OF THIS OFFERING]',
      otras: (linea: string) => `More from ${linea}`,
      soluciones: ['Recommended ', 'for'],
      cotizarEsta: 'Get a quote for this',
      wa: (oferta: string, linea: string) => `Hi Antídoto, I would like a quote for ${oferta.toLowerCase()} (${linea.toLowerCase()}).`,
    },

    soluciones: {
      titulo: ['Solutions by ', 'team'],
      lead: 'Every team comes with a different challenge. Start with yours and we will show you what works best.',
      retos: ['What we ', 'solve'],
      reto: 'The challenge',
      solucion: 'How we solve it',
      ofertas: ['What we ', 'recommend'],
      clientes: 'They have trusted us',
      casoPendiente: '[REAL CASE FOR THIS TEAM: company, challenge and a figure validated by the client]',
      educacionPendiente: '[TYPICAL CHALLENGES OF SCHOOLS AND UNIVERSITIES, validated by the client]',
    },

    portafolio: {
      titulo: ['Our ', 'work'],
      lead: 'Real training, video, catering and design projects, told from start to finish.',
      todos: 'All',
      vacio: '[PORTFOLIO CASES: client with permission, challenge, solution, result and photos]',
      vacioLead: 'While we publish the cases, take a look at the brands that have worked with us.',
      verClientes: 'See clients',
      reto: 'The challenge',
      solucion: 'What we did',
      resultado: 'The result',
      cliente: 'Client',
      linea: 'Line',
      otros: ['More ', 'cases'],
    },

    nosotros: {
      empresa: ['A creative studio with ', 'an engineering mindset'],
      datosTitulo: 'Antídoto at a glance',
      equipo: ['Our ', 'team'],
      seguir: ['Learn ', 'more'],
    },

    como: {
      titulo: ['How we work ', 'with you'],
      lead: 'Three steps, from the first conversation to the final report. One team answers for everything.',
      entregamos: ['What you ', 'get'],
      entregamosPendiente: '[DELIVERABLES AT THE END: record, report, evaluation or certificates depending on the service]',
      tiempos: ['Response ', 'times'],
      tiemposPendiente: '[QUOTE RESPONSE TIME AND RECOMMENDED LEAD TIME PER SERVICE]',
    },

    trabaja: {
      titulo: ['Work ', 'with us'],
      lead: 'We are looking for partners who want to add creative production to their programs and talent who want to create with us.',
      aliadosTitulo: ['For ', 'partners'],
      aliadosLead: 'Health and safety consultancies, insurance brokers, insurers and agencies: we add our production to your clients’ programs.',
      aliadosPuntos: ['Training and videos with your brand or your client’s', 'One team for production and logistics', 'Quotes per project'],
      aliadosWa: 'Hi Antídoto, I would like to talk about a partnership.',
      aliadosCta: 'Talk about a partnership',
      talentoTitulo: ['For ', 'talent'],
      talentoLead: 'Facilitators, video producers, cooks and designers. Send us your resume or portfolio by email.',
      talentoAsunto: 'Resume for Antídoto',
      talentoCta: 'Send your resume',
      vacantesPendiente: '[OPEN POSITIONS, if any]',
    },

    faq: {
      titulo: ['Frequently asked ', 'questions'],
      lead: 'What people ask us most before requesting a quote. If you cannot find your answer, message us.',
      temas: {
        general: 'General',
        formaciones: 'Training',
        audiovisual: 'Video production',
        catering: 'Catering',
        diseno: 'Design',
        cotizacion: 'Quotes',
      },
      indice: 'Topics',
      todas: 'See all questions',
      otra: ['Have another question?', 'Message us and we will answer on WhatsApp.'],
    },

    blog: {
      titulo: ['Ideas for ', 'your team'],
      lead: 'Notes on health and safety, training, video, events and culture for people who train and care for their teams.',
      categorias: { sst: 'Health and safety', formacion: 'Training', audiovisual: 'Video', eventos: 'Events', cultura: 'Culture' },
      todas: 'All',
      vacio: '[FIRST BLOG POSTS: topics and author defined with the client]',
      por: 'By',
      relacionados: ['Related ', 'services'],
      otros: ['More ', 'posts'],
      rss: 'Subscribe via RSS',
      fecha: (d: Date) => new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(d),
    },

    legal: {
      borrador: 'Draft pending legal review',
      actualizado: 'Last updated',
      terminos: {
        titulo: 'Terms and conditions',
        lead: 'Terms of use of this website.',
        secciones: [
          ['Who we are', 'This site belongs to Antídoto. [COMPANY NAME, TAX ID AND ADDRESS]'],
          ['Use of the site', 'The site provides information about Antídoto’s services and lets you request quotes. By using it you agree not to use it unlawfully or interfere with how it works.'],
          ['Quotes', 'The quotes you build on the site are a request, not an offer or a contract. The terms of each service are agreed in writing in the proposal.'],
          ['Intellectual property', 'The texts, photos, videos, logos and design of the site belong to Antídoto or their owners. Client brands are shown for information purposes.'],
          ['Third party links', 'The site links to WhatsApp, Instagram and LinkedIn. Each service has its own terms.'],
          ['Personal data', 'Data processing is governed by the data processing policy.'],
          ['Governing law', '[GOVERNING LAW AND JURISDICTION, to be defined with the lawyer]'],
        ],
      },
      cookies: {
        titulo: 'Cookies',
        lead: 'What this site stores in your browser and why.',
        secciones: [
          ['Summary', 'This site does not use advertising cookies or cross site tracking.'],
          ['What we store', 'During your visit only, we store in your browser where you came from (for example, a campaign) to learn which channel works when you request a quote. We also keep copies of pages so the site works offline.'],
          ['Analytics', '[ANALYTICS TOOL, if enabled: for example, a cookieless one]'],
          ['How to delete it', 'You can delete this data from your browser settings at any time.'],
        ],
      },
    },

    mapa: {
      titulo: ['Site ', 'map'],
      lead: 'Every page of the site in one place.',
      grupos: { servicios: 'Services', soluciones: 'Solutions', empresa: 'Company', recursos: 'Resources', legal: 'Legal' },
    },

    noEncontrada: {
      lead: 'The link may be mistyped or the page may have moved. These are the sections of the site:',
    },
  },
} as const;

export function tp(locale: Locale) {
  return paginas[locale];
}
