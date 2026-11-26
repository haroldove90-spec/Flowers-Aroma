import roseRedImg from '../assets/images/rose_red_freedom_1795728584400.jpg';
import roseWhiteImg from '../assets/images/rose_white_mondial_1795728584700.jpg';
import rosePinkImg from '../assets/images/rose_pink_hermosa_1795728585514.jpg';
import rosePurpleImg from '../assets/images/rose_lavender_purple_1795728586548.jpg';
import rosePeachImg from '../assets/images/rose_peach_champagne_1795728586753.jpg';
import roseMixedImg from '../assets/images/rose_mixed_bouquet_1795728587771.jpg';
import { AromaProduct } from '../types/greenhouse';

export interface PosProductPresetMeta {
  defaultImage: string;
  colorLabel: string;
  defaultPriceLar: number;
  defaultPriceMed: number;
  defaultPriceChi: number;
  categoryTag: 'rojas' | 'blancas' | 'rosas' | 'especiales' | 'combinados';
}

const VARIETY_META_MAP: Record<string, PosProductPresetMeta> = {
  FREEDOM: {
    defaultImage: roseRedImg,
    colorLabel: 'Roja aterciopelada',
    defaultPriceLar: 180,
    defaultPriceMed: 150,
    defaultPriceChi: 120,
    categoryTag: 'rojas',
  },
  MONDIAL: {
    defaultImage: roseWhiteImg,
    colorLabel: 'Blanca crema',
    defaultPriceLar: 190,
    defaultPriceMed: 160,
    defaultPriceChi: 130,
    categoryTag: 'blancas',
  },
  MUNDIAL: {
    defaultImage: roseWhiteImg,
    colorLabel: 'Blanca marfil',
    defaultPriceLar: 190,
    defaultPriceMed: 160,
    defaultPriceChi: 130,
    categoryTag: 'blancas',
  },
  PROUD: {
    defaultImage: roseWhiteImg,
    colorLabel: 'Blanca pura',
    defaultPriceLar: 185,
    defaultPriceMed: 155,
    defaultPriceChi: 125,
    categoryTag: 'blancas',
  },
  HERMOSA: {
    defaultImage: rosePinkImg,
    colorLabel: 'Rosa pastel',
    defaultPriceLar: 175,
    defaultPriceMed: 145,
    defaultPriceChi: 115,
    categoryTag: 'rosas',
  },
  TOPAZ: {
    defaultImage: rosePinkImg,
    colorLabel: 'Rosa fucsia',
    defaultPriceLar: 175,
    defaultPriceMed: 145,
    defaultPriceChi: 115,
    categoryTag: 'rosas',
  },
  CARICIA: {
    defaultImage: rosePinkImg,
    colorLabel: 'Rosa suave',
    defaultPriceLar: 170,
    defaultPriceMed: 140,
    defaultPriceChi: 110,
    categoryTag: 'rosas',
  },
  HOMER: {
    defaultImage: roseRedImg,
    colorLabel: 'Roja coral',
    defaultPriceLar: 175,
    defaultPriceMed: 145,
    defaultPriceChi: 115,
    categoryTag: 'rojas',
  },
  'DEEP PURPLE': {
    defaultImage: rosePurpleImg,
    colorLabel: 'Lila borde púrpura',
    defaultPriceLar: 190,
    defaultPriceMed: 160,
    defaultPriceChi: 130,
    categoryTag: 'especiales',
  },
  'COOL WATER': {
    defaultImage: rosePurpleImg,
    colorLabel: 'Lavanda fresca',
    defaultPriceLar: 185,
    defaultPriceMed: 155,
    defaultPriceChi: 125,
    categoryTag: 'especiales',
  },
  NOVIA: {
    defaultImage: roseWhiteImg,
    colorLabel: 'Blanca novia',
    defaultPriceLar: 185,
    defaultPriceMed: 155,
    defaultPriceChi: 125,
    categoryTag: 'blancas',
  },
  BOULEVARD: {
    defaultImage: rosePeachImg,
    colorLabel: 'Durazno champagne',
    defaultPriceLar: 180,
    defaultPriceMed: 150,
    defaultPriceChi: 120,
    categoryTag: 'especiales',
  },
  SAMURAY: {
    defaultImage: roseRedImg,
    colorLabel: 'Roja intensa',
    defaultPriceLar: 180,
    defaultPriceMed: 150,
    defaultPriceChi: 120,
    categoryTag: 'rojas',
  },
  SALMA: {
    defaultImage: rosePinkImg,
    colorLabel: 'Rosa intenso',
    defaultPriceLar: 175,
    defaultPriceMed: 145,
    defaultPriceChi: 115,
    categoryTag: 'rosas',
  },
  BLANCARICIA: {
    defaultImage: roseWhiteImg,
    colorLabel: 'Blanca delicada',
    defaultPriceLar: 180,
    defaultPriceMed: 150,
    defaultPriceChi: 120,
    categoryTag: 'blancas',
  },
  SHIMER: {
    defaultImage: rosePeachImg,
    colorLabel: 'Durazno rosado',
    defaultPriceLar: 190,
    defaultPriceMed: 160,
    defaultPriceChi: 130,
    categoryTag: 'especiales',
  },
  SHIMMER: {
    defaultImage: rosePeachImg,
    colorLabel: 'Durazno rosado',
    defaultPriceLar: 190,
    defaultPriceMed: 160,
    defaultPriceChi: 130,
    categoryTag: 'especiales',
  },
  MANDALA: {
    defaultImage: roseRedImg,
    colorLabel: 'Roja bicolor',
    defaultPriceLar: 185,
    defaultPriceMed: 155,
    defaultPriceChi: 125,
    categoryTag: 'rojas',
  },
  'BEE SWEET': {
    defaultImage: rosePeachImg,
    colorLabel: 'Amarillo miel',
    defaultPriceLar: 180,
    defaultPriceMed: 150,
    defaultPriceChi: 120,
    categoryTag: 'especiales',
  },
  'OCEAN SUN': {
    defaultImage: rosePeachImg,
    colorLabel: 'Naranja dorado',
    defaultPriceLar: 180,
    defaultPriceMed: 150,
    defaultPriceChi: 120,
    categoryTag: 'especiales',
  },
  GOTCHA: {
    defaultImage: rosePinkImg,
    colorLabel: 'Rosa encendido',
    defaultPriceLar: 185,
    defaultPriceMed: 155,
    defaultPriceChi: 125,
    categoryTag: 'rosas',
  },
  INGLESA: {
    defaultImage: rosePeachImg,
    colorLabel: 'Jardín inglés',
    defaultPriceLar: 195,
    defaultPriceMed: 165,
    defaultPriceChi: 135,
    categoryTag: 'especiales',
  },
  COMBINADOS: {
    defaultImage: roseMixedImg,
    colorLabel: 'Surtido multicolor',
    defaultPriceLar: 165,
    defaultPriceMed: 140,
    defaultPriceChi: 110,
    categoryTag: 'combinados',
  },
  'STD Y MOL': {
    defaultImage: roseMixedImg,
    colorLabel: 'Estándar y molotes',
    defaultPriceLar: 110,
    defaultPriceMed: 110,
    defaultPriceChi: 110,
    categoryTag: 'combinados',
  },
};

const FALLBACK_META: PosProductPresetMeta = {
  defaultImage: roseMixedImg,
  colorLabel: 'Rosa de corte · 25 tallos',
  defaultPriceLar: 180,
  defaultPriceMed: 150,
  defaultPriceChi: 120,
  categoryTag: 'especiales',
};

export const getPosProductMeta = (product: Pick<AromaProduct, 'name' | 'imageUrl' | 'priceLar' | 'priceMed' | 'priceChi'>) => {
  const key = (product.name || '').trim().toUpperCase();
  const preset = VARIETY_META_MAP[key] || FALLBACK_META;
  return {
    imageSrc: product.imageUrl && product.imageUrl.trim() ? product.imageUrl : preset.defaultImage,
    hasCustomImage: Boolean(product.imageUrl && product.imageUrl.trim()),
    colorLabel: preset.colorLabel,
    categoryTag: preset.categoryTag,
    priceLar:
      product.priceLar !== undefined && product.priceLar !== null && Number(product.priceLar) > 0
        ? Number(product.priceLar)
        : preset.defaultPriceLar,
    priceMed:
      product.priceMed !== undefined && product.priceMed !== null && Number(product.priceMed) > 0
        ? Number(product.priceMed)
        : preset.defaultPriceMed,
    priceChi:
      product.priceChi !== undefined && product.priceChi !== null && Number(product.priceChi) > 0
        ? Number(product.priceChi)
        : preset.defaultPriceChi,
  };
};

/**
 * Comprime una fotografía de producto subida desde computadora o celular
 * a JPEG optimizado (~520px ancho) para guardar rápido en localStorage y Supabase.
 */
export const compressProductImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 520;
        const maxHeight = 420;
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen.'));
          return;
        }
        ctx.fillStyle = '#FAF8F5';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => reject(new Error('Archivo de imagen inválido.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    reader.readAsDataURL(file);
  });
};
