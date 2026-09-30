// Los cuatro servicios. Textos tomados del sitio actual y del brief del cliente; no agregar cifras ni claims sin validar.
import type { ImageMetadata } from 'astro';
import type { Locale } from '../i18n/ui';
import formacion from '../assets/fotos/formacion-bandera.jpg';
import grabacion from '../assets/fotos/grabacion.jpg';
import catering from '../assets/fotos/catering-buffet.jpg';
import figura from '../assets/fotos/figura-piezas.jpg';

interface ServicioTexto {
  slug: string;
  title: string;
  lead: string;
  facts: string[];
  includes: string[];
  alt: string;
}

export interface Servicio {
  id: string;
  image: ImageMetadata;
  /** Foto provisional hasta tener material real del servicio. */
  provisional?: boolean;
  es: ServicioTexto;
  en: ServicioTexto;
}

export const SERVICIOS: Servicio[] = [
  {
    id: 'formaciones',
    image: formacion,
    es: {
      slug: 'formaciones-vivenciales',
      title: 'Formaciones vivenciales',
      lead: 'Aprender haciendo: programas participativos con apoyo de IA para fortalecer equipos, cultura, comunicación, orientación vocacional e inclusión.',
      facts: ['Español, portugués e inglés', 'Con apoyo de IA', 'Empresas y colegios'],
      includes: ['Fortalecimiento de equipos', 'Cultura organizacional', 'Comunicación', 'Orientación vocacional', 'Inclusión'],
      alt: 'Equipo celebrando con una bandera de Colombia junto a la maqueta que construyó en un taller',
    },
    en: {
      slug: 'experiential-training',
      title: 'Experiential training',
      lead: 'Learning by doing: participatory programs, supported by AI, that strengthen teams, culture, communication, career guidance and inclusion.',
      facts: ['Spanish, Portuguese and English', 'AI supported', 'Companies and schools'],
      includes: ['Team building', 'Organizational culture', 'Communication', 'Career guidance', 'Inclusion'],
      alt: 'Team celebrating with a Colombian flag next to the model they built in a workshop',
    },
  },
  {
    id: 'audiovisual',
    image: grabacion,
    es: {
      slug: 'produccion-audiovisual',
      title: 'Producción audiovisual',
      lead: 'Inducciones, planes de emergencia, capacitaciones y videos institucionales, con estrategias digitales apoyadas en IA.',
      facts: ['+150 producciones', '4K y tomas con dron', 'Estrategia digital con IA'],
      includes: ['Videos de inducción', 'Planes de emergencia', 'Capacitaciones', 'Videos institucionales', 'Tomas aéreas con dron'],
      alt: 'Grabación al aire libre con cámara y luz de estudio',
    },
    en: {
      slug: 'video-production',
      title: 'Video production',
      lead: 'Onboarding, emergency plans, training and corporate videos, with AI supported digital strategy.',
      facts: ['150+ productions', '4K and drone footage', 'AI supported digital strategy'],
      includes: ['Onboarding videos', 'Emergency plans', 'Training', 'Corporate videos', 'Drone footage'],
      alt: 'Outdoor shoot with a camera and a studio light',
    },
  },
  {
    id: 'catering',
    image: catering,
    es: {
      slug: 'catering-corporativo',
      title: 'Catering corporativo',
      lead: 'Desayunos, refrigerios, almuerzos y estaciones en vivo para eventos empresariales, académicos y sociales.',
      facts: ['+200 eventos', 'Cobertura nacional', 'Logística flexible'],
      includes: ['Desayunos', 'Refrigerios', 'Almuerzos', 'Estaciones en vivo'],
      alt: 'Equipo de Antídoto sirviendo un buffet con flores y pasabocas',
    },
    en: {
      slug: 'corporate-catering',
      title: 'Corporate catering',
      lead: 'Breakfasts, snacks, lunches and live food stations for corporate, academic and social events.',
      facts: ['200+ events', 'Nationwide', 'Flexible logistics'],
      includes: ['Breakfasts', 'Snacks', 'Lunches', 'Live food stations'],
      alt: 'The Antídoto team serving a buffet with flowers and appetizers',
    },
  },
  {
    id: 'diseno',
    image: figura,
    provisional: true,
    es: {
      slug: 'diseno-de-productos',
      title: 'Diseño de productos y experiencias',
      lead: 'De la idea al producto final: prototipos, productos funcionales y experiencias a la medida con la identidad de cada marca.',
      facts: ['Prototipos', 'Productos funcionales', 'Experiencias a medida'],
      includes: ['Prototipos', 'Productos funcionales', 'Experiencias de marca'],
      alt: 'Figura armada con piezas de construcción',
    },
    en: {
      slug: 'product-design',
      title: 'Product and experience design',
      lead: 'From idea to finished product: prototypes, functional products and custom experiences that carry each brand’s identity.',
      facts: ['Prototypes', 'Functional products', 'Custom experiences'],
      includes: ['Prototypes', 'Functional products', 'Brand experiences'],
      alt: 'Figure built with construction bricks',
    },
  },
];

export const serviciosBase: Record<Locale, string> = { es: '/servicios/', en: '/en/services/' };

export function servicioPath(s: Servicio, locale: Locale): string {
  return `${serviciosBase[locale]}${s[locale].slug}/`;
}
